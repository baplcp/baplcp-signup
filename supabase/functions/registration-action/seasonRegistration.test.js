import assert from 'node:assert/strict'
import test from 'node:test'
import { directSeasonRegister } from './registrationCommands.ts'

function registrationStore() {
  const writes = []
  const rows = {
    seasons: [{ id: 7, season_enabled: true, season_late_enabled: true, season_open_date: '2026-06-01', season_open_time: '10:00', season_close_date: '2026-07-31', season_close_time: '23:59' }],
    activity_dates: [
      { season_id: 7, activity_date: '2026-07-03' },
      { season_id: 7, activity_date: '2026-10-02' },
    ],
    registrations: [{ id: 'existing', season_id: 7, member_id: 'member', season_plan: 'quarter', activity_date_id: null, cancelled_at: null }],
  }
  const supabase = {
    from(table) {
      let values = rows[table]
      const query = {
        select() {
          return this
        },
        eq(field, value) {
          values = values.filter(row => row[field] === value)
          return this
        },
        is(field, value) {
          values = values.filter(row => row[field] === value)
          return this
        },
        order() {
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: values[0] || null, error: null })
        },
        then(resolve) {
          return Promise.resolve({ data: values, error: null }).then(resolve)
        },
      }
      return query
    },
    rpc(name, payload) {
      writes.push({ name, payload })
      return Promise.resolve({ data: 'existing', error: null })
    },
  }
  return { supabase, writes }
}

test('season registration checks fresh overlap before the closed window', async () => {
  const { supabase, writes } = registrationStore()
  const result = await directSeasonRegister({ supabase, memberId: 'member', activityId: 7, now: new Date('2026-10-03T12:00:00+08:00') }, { seasonPlan: 'half-year' })
  assert.deepEqual(result, { error: 'season_plan_overlap', status: 409 })
  assert.equal(writes.length, 0)
})

test('same plan can be resent in time but is rejected after the deadline', async () => {
  const { supabase, writes } = registrationStore()
  const retry = await directSeasonRegister({ supabase, memberId: 'member', activityId: 7, now: new Date('2026-07-03T12:00:00+08:00') }, { seasonPlan: 'quarter' })
  assert.deepEqual(retry, { ok: true })
  assert.equal(writes.length, 1)

  const closed = await directSeasonRegister({ supabase, memberId: 'member', activityId: 7, now: new Date('2026-08-01T00:00:00+08:00') }, { seasonPlan: 'quarter' })
  assert.deepEqual(closed, { error: 'registration_closed', status: 403 })
  assert.equal(writes.length, 1)

  const started = await directSeasonRegister({ supabase, memberId: 'member', activityId: 7, now: new Date('2026-07-04T00:00:00+08:00') }, { seasonPlan: 'quarter' })
  assert.deepEqual(started, { error: 'season_plan_started', status: 400 })
  assert.equal(writes.length, 1)
})
