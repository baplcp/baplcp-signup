import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { ref } from 'vue'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('~/')) return nextResolve(specifier, context)
    const path = specifier.slice(2)
    return nextResolve(new URL(`../${path}${path.endsWith('.js') ? '' : '.js'}`, import.meta.url).href, context)
  },
})

const { useSignupInteraction } = await import('./useSignupInteraction.js')

test('a pickup signup writes once, refreshes the snapshot, and reports the result', async () => {
  const calls = []
  const activityData = ref({ id: 7, pickup_open_days_before: 0, pickup_open_time: '00:00', dates: ['2026-10-24'] })
  const snapshot = {
    activityData,
    resolvedDate: ref('2026-10-24'),
    myRegistration: ref(null),
    mySeasonRegistration: ref(null),
    mySeasonRegistrations: ref([]),
    refresh: async () => {
      calls.push('refresh')
      return true
    },
  }
  const feedback = { show: options => calls.push(options) }
  const interaction = useSignupInteraction({
    identity: { userId: 'member', initialize: async () => {}, login: () => {} },
    snapshot,
    activityType: ref('pickup'),
    isAdmin: ref(false),
    nowTick: ref(new Date('2026-10-24T04:00:00.000Z')),
    isLoading: ref(false),
    adminMode: ref(false),
    feedback,
    writeRegistration: async body => calls.push(body),
  })

  interaction.setSignupOpen(true)
  interaction.adjustSignupCount('self', 1)
  await interaction.submitSignup()

  assert.equal(calls[0].action, 'save-registration')
  assert.equal(calls[0].selfCount, 1)
  assert.equal(calls[1], 'refresh')
  assert.equal(calls[2].title, '報名已送出')
  assert.equal(interaction.signupOpen.value, false)
})

test('a season member can confirm leave for one pickup date', async () => {
  const writes = []
  const notices = []
  const snapshot = {
    activityData: ref({ id: 7, pickup_open_days_before: 0, pickup_open_time: '00:00', dates: ['2026-10-24'] }),
    resolvedDate: ref('2026-10-24'),
    myRegistration: ref(null),
    mySeasonRegistration: ref({ id: 'season-1', leave_dates: [] }),
    mySeasonRegistrations: ref([]),
    refresh: async () => true,
  }
  const interaction = useSignupInteraction({
    identity: { userId: 'member', initialize: async () => {}, login: () => {} },
    snapshot,
    activityType: ref('pickup'),
    isAdmin: ref(false),
    nowTick: ref(new Date('2026-10-24T04:00:00.000Z')),
    isLoading: ref(false),
    adminMode: ref(false),
    feedback: { show: options => notices.push(options), focusElement: () => {} },
    writeRegistration: async body => writes.push(body),
  })

  interaction.setSignupOpen(true)
  interaction.adjustSignupCount('self', -1)
  assert.equal(interaction.leaveConfirmOpen.value, true)
  interaction.confirmLeaveConfirm()
  await interaction.submitSignup()

  assert.equal(writes[0].action, 'season-leave')
  assert.equal(writes[0].activityDate, '2026-10-24')
  assert.equal(writes[0].selfCount, 0)
  assert.equal(notices[0].title, '已請假')
})

test('a successful write still reports success when the snapshot refresh fails', async () => {
  const notices = []
  const interaction = useSignupInteraction({
    identity: { userId: 'member', initialize: async () => {}, login: () => {} },
    snapshot: {
      activityData: ref({ id: 7, pickup_open_days_before: 0, pickup_open_time: '00:00' }),
      resolvedDate: ref('2026-10-24'),
      myRegistration: ref(null),
      mySeasonRegistration: ref(null),
      mySeasonRegistrations: ref([]),
      refresh: async () => false,
    },
    activityType: ref('pickup'),
    isAdmin: ref(false),
    nowTick: ref(new Date('2026-10-24T04:00:00.000Z')),
    isLoading: ref(false),
    adminMode: ref(false),
    feedback: { show: options => notices.push(options) },
    writeRegistration: async () => {},
  })

  interaction.setSignupOpen(true)
  interaction.adjustSignupCount('self', 1)
  await interaction.submitSignup()

  assert.equal(notices[0].title, '報名已送出')
  assert.match(notices[0].copy, /名單暫時未同步/)
})

test('season signup and cancellation use the selected plan and refresh the snapshot', async () => {
  const writes = []
  const mine = ref(null)
  const myPlans = ref([])
  const snapshot = {
    activityData: ref({ id: 7, season_enabled: true, dates: ['2026-10-30'], season_open_date: '2026-10-01', season_open_time: '00:00' }),
    resolvedDate: ref('2026-10-30'),
    myRegistration: mine,
    mySeasonRegistration: ref(null),
    mySeasonRegistrations: myPlans,
    refresh: async () => {
      if (writes.at(-1)?.action === 'direct-season-register') {
        mine.value = { id: 'season-1', is_self_registration: true, season_plan: 'quarter', guests: [] }
        myPlans.value = [mine.value]
      } else {
        mine.value = null
        myPlans.value = []
      }
      return true
    },
  }
  const identity = { userId: 'member', isSeason: false, initialize: async () => {}, login: () => {} }
  const interaction = useSignupInteraction({
    identity,
    snapshot,
    activityType: ref('season'),
    isAdmin: ref(false),
    nowTick: ref(new Date('2026-10-24T04:00:00.000Z')),
    isLoading: ref(false),
    adminMode: ref(false),
    feedback: { show: () => {}, focusElement: () => {} },
    writeRegistration: async body => writes.push(body),
  })

  await interaction.handleSeasonPlanConfirm('quarter')
  assert.equal(writes[0].action, 'direct-season-register')
  assert.equal(writes[0].seasonPlan, 'quarter')
  assert.equal(identity.isSeason, true)

  await interaction.handleCtaClick()
  assert.equal(interaction.seasonCancelOpen.value, true)
  await interaction.confirmSeasonCancel()
  assert.equal(writes[1].action, 'season-cancel')
  assert.equal(writes[1].seasonPlan, 'quarter')
  assert.equal(identity.isSeason, false)
})
