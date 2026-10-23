import assert from 'node:assert/strict'
import test from 'node:test'
import { useActivityPageSnapshot } from './useActivityPageSnapshot.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

function pickupPage(dateId, name) {
  return {
    activity: { id: 7, selected_activity_date_id: dateId, selected_activity_date: `2026-10-${dateId}`, dates: [`2026-10-${dateId}`], ac_enabled: false, ac_fee: 0 },
    pickup_registrations: [{ id: `registration-${dateId}`, user_id: name, is_self_registration: true, guests: [] }],
    season_registrations: [],
  }
}

test('switching dates ignores an earlier response for the same activity', async () => {
  const first = deferred()
  const second = deferred()
  const snapshot = useActivityPageSnapshot({
    liffStore: { userId: 'member', gender: null, initialize: async () => {} },
    loadPage: (_id, dateId) => (dateId === '1' ? first.promise : second.promise),
    subscribe: () => null,
    unsubscribe: () => {},
  })

  const oldLoad = snapshot.open({ id: '7', dateId: '1', season: false })
  const newLoad = snapshot.open({ id: '7', dateId: '2', season: false })
  second.resolve(pickupPage(2, 'member'))
  await newLoad
  first.resolve(pickupPage(1, 'other'))
  await oldLoad

  assert.equal(snapshot.activityData.value.selected_activity_date_id, 2)
  assert.equal(snapshot.registrations.value[0].id, 'registration-2')
  snapshot.dispose()
})

test('a failed background refresh keeps the last complete page', async () => {
  let fail = false
  const snapshot = useActivityPageSnapshot({
    liffStore: { userId: 'member', gender: null, initialize: async () => {} },
    loadPage: async () => {
      if (fail) throw new Error('network_error')
      return pickupPage(1, 'member')
    },
    subscribe: () => null,
    unsubscribe: () => {},
  })

  await snapshot.open({ id: '7', dateId: '1', season: false })
  fail = true
  await assert.rejects(snapshot.refresh(), /network_error/)

  assert.equal(snapshot.activityLoadState.value, 'ready')
  assert.equal(snapshot.activityData.value.selected_activity_date_id, 1)
  assert.equal(snapshot.registrations.value[0].id, 'registration-1')
  assert.equal(snapshot.isStale.value, true)
  snapshot.dispose()
})

test('invalid first page is an error rather than an empty registration list', async () => {
  const snapshot = useActivityPageSnapshot({
    liffStore: { userId: 'member', gender: null, initialize: async () => {} },
    loadPage: async () => ({ activity: { id: 7 } }),
    subscribe: () => null,
    unsubscribe: () => {},
  })

  await assert.rejects(snapshot.open({ id: '7', dateId: '1', season: false }), /invalid_activity_page/)
  assert.equal(snapshot.activityLoadState.value, 'error')
  snapshot.dispose()
})

test('a confirmed payment stays visible after refresh failure until fresh data arrives', async () => {
  let fail = false
  let paid = false
  const snapshot = useActivityPageSnapshot({
    liffStore: { userId: 'member', gender: null, initialize: async () => {} },
    loadPage: async () => {
      if (fail) throw new Error('network_error')
      const page = pickupPage(1, 'member')
      page.pickup_registrations[0].paid_court = paid
      return page
    },
    subscribe: () => null,
    unsubscribe: () => {},
  })

  await snapshot.open({ id: '7', dateId: '1', season: false })
  fail = true
  await snapshot.updatePayment({ _memberType: 'self', _regId: 'registration-1' }, 'paid_court', async () => {})
  assert.equal(snapshot.registrations.value[0].paid_court, true)

  fail = false
  await snapshot.refresh()
  assert.equal(snapshot.registrations.value[0].paid_court, true)
  assert.equal(snapshot.isStale.value, true)

  paid = true
  await snapshot.refresh()
  assert.equal(snapshot.registrations.value[0].paid_court, true)
  assert.equal(snapshot.isStale.value, false)
  snapshot.dispose()
})

test('realtime events refresh the visible page without replacing it while loading', async () => {
  let onChange
  let name = 'first'
  let loads = 0
  const snapshot = useActivityPageSnapshot({
    liffStore: { userId: 'member', gender: null, initialize: async () => {} },
    loadPage: async () => {
      loads++
      return pickupPage(1, name)
    },
    subscribe: (_id, callback) => {
      onChange = callback
      return {}
    },
    unsubscribe: () => {},
    refreshDelay: 1,
  })

  await snapshot.open({ id: '7', dateId: '1', season: false })
  name = 'second'
  onChange()
  onChange()
  await new Promise(resolve => setTimeout(resolve, 20))

  assert.equal(snapshot.activityLoadState.value, 'ready')
  assert.equal(snapshot.registrations.value[0].user_id, 'second')
  assert.equal(loads, 2)
  snapshot.dispose()
})

test('guest payment and air conditioning roll back without changing another date', async () => {
  const snapshot = useActivityPageSnapshot({
    liffStore: { userId: 'member', gender: null, initialize: async () => {} },
    loadPage: async (_id, dateId) => {
      const page = pickupPage(Number(dateId), 'member')
      page.pickup_registrations[0].guests = [{ id: 'guest-1', paid_court: false }]
      return page
    },
    subscribe: () => null,
    unsubscribe: () => {},
  })

  await snapshot.open({ id: '7', dateId: '1', season: false })
  await assert.rejects(
    snapshot.updatePayment({ _memberType: 'guest', _guestId: 'guest-1', paidCourt: false }, 'paid_court', async () => {
      assert.equal(snapshot.registrations.value[0].guests[0].paid_court, true)
      throw new Error('write_failed')
    }),
    /write_failed/
  )
  await assert.rejects(
    snapshot.updateAcEnabled(true, async () => {
      assert.equal(snapshot.acEnabled.value, true)
      throw new Error('write_failed')
    }),
    /write_failed/
  )
  assert.equal(snapshot.registrations.value[0].guests[0].paid_court, false)
  assert.equal(snapshot.acEnabled.value, false)

  const oldWrite = deferred()
  const pending = snapshot.updatePayment({ _memberType: 'guest', _guestId: 'guest-1', paidCourt: false }, 'paid_court', () => oldWrite.promise)
  assert.equal(await snapshot.updatePayment({ _memberType: 'guest', _guestId: 'guest-1', paidCourt: true }, 'paid_court', async () => {}), false)
  await snapshot.open({ id: '7', dateId: '2', season: false })
  oldWrite.reject(new Error('old_write_failed'))
  assert.equal(await pending, false)
  assert.equal(snapshot.registrations.value[0].guests[0].paid_court, false)
  snapshot.dispose()
})

test('air conditioning stays optimistic until a later page confirms the write', async () => {
  let enabled = false
  const snapshot = useActivityPageSnapshot({
    liffStore: { userId: 'member', gender: null, initialize: async () => {} },
    loadPage: async () => {
      const page = pickupPage(1, 'member')
      page.activity.ac_enabled = enabled
      return page
    },
    subscribe: () => null,
    unsubscribe: () => {},
  })

  await snapshot.open({ id: '7', dateId: '1', season: false })
  await snapshot.updateAcEnabled(true, async () => {})
  assert.equal(snapshot.acEnabled.value, true)
  assert.equal(snapshot.isStale.value, true)

  enabled = true
  await snapshot.refresh()
  assert.equal(snapshot.acEnabled.value, true)
  assert.equal(snapshot.isStale.value, false)
  snapshot.dispose()
})
