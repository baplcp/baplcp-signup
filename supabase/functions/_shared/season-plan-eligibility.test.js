import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateSeasonPlans } from './season-plan-eligibility.ts'

const activity = {
  season_enabled: true,
  season_late_enabled: true,
  season_open_date: '2026-06-01',
  season_open_time: '10:00',
  season_close_date: '2026-07-31',
  season_close_time: '23:59',
  season_late_open_date: '2026-07-01',
  season_late_open_time: '10:00',
  season_late_close_date: '2026-09-30',
  season_late_close_time: '23:59',
}
const dates = ['2026-07-03', '2026-08-07', '2026-10-02']

test('quarter is selectable while late quarter waits until the day after the first quarter session', () => {
  const plans = evaluateSeasonPlans(activity, dates, [], new Date('2026-07-03T08:00:00+08:00'))
  assert.equal(plans.find(plan => plan.plan === 'quarter').reason, null)
  assert.equal(plans.find(plan => plan.plan === 'late-quarter').reason, 'registration_not_open')

  const nextDay = evaluateSeasonPlans(activity, dates, [], new Date('2026-07-04T10:00:00+08:00'))
  assert.equal(nextDay.find(plan => plan.plan === 'late-quarter').reason, null)
})

test('registered and overlapping plans have distinct reasons before time restrictions', () => {
  const plans = evaluateSeasonPlans(activity, dates, ['quarter'], new Date('2026-10-03T12:00:00+08:00'))
  assert.equal(plans.find(plan => plan.plan === 'quarter').reason, 'already_registered')
  assert.equal(plans.find(plan => plan.plan === 'half-year').reason, 'season_plan_overlap')
  assert.equal(plans.find(plan => plan.plan === 'late-quarter').reason, 'registration_closed')
})

test('closed, started, unopened and unavailable plans expose the expected reasons', () => {
  const closed = evaluateSeasonPlans(activity, dates, [], new Date('2026-08-01T00:00:00+08:00'))
  assert.equal(closed.find(plan => plan.plan === 'quarter').reason, 'registration_closed')
  assert.equal(closed.find(plan => plan.plan === 'half-year').reason, 'registration_closed')

  const started = evaluateSeasonPlans({ ...activity, season_close_date: null }, dates, [], new Date('2026-08-01T00:00:00+08:00'))
  assert.equal(started.find(plan => plan.plan === 'quarter').reason, 'season_plan_started')

  const unopened = evaluateSeasonPlans(activity, dates, [], new Date('2026-05-31T10:00:00+08:00'))
  assert.equal(unopened.find(plan => plan.plan === 'quarter').reason, 'registration_not_open')

  const unavailable = evaluateSeasonPlans({ ...activity, season_late_enabled: false }, dates, [], new Date('2026-07-04T10:00:00+08:00'))
  assert.equal(unavailable.find(plan => plan.plan === 'late-quarter').reason, 'season_plan_unavailable')
  const disabled = evaluateSeasonPlans({ ...activity, season_enabled: false }, dates, [], new Date('2026-07-03T10:00:00+08:00'))
  assert.equal(disabled.find(plan => plan.plan === 'quarter').reason, 'season_plan_unavailable')
})
