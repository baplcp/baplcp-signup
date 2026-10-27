import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOpenLeaveReminder, listOpenedPickupSessions } from './openLeaveReminder.ts'

const opening = { seasonId: 7, activityDateId: 42, activityDate: '2026-11-08', title: '週日排球', pickupLabel: '週日臨打' }

test('finds only pickup sessions whose registration opened in the last minute', async () => {
  const now = new Date('2026-11-01T12:00:00.000Z')
  const supabase = {
    rpc: async (name, args) => {
      assert.equal(name, 'list_registration_open_notification_candidates')
      assert.deepEqual(args, { p_window_start: '2026-11-01T11:59:00.000Z', p_window_end: now.toISOString() })
      return {
        data: [
          { season_id: 7, activity_date_id: 42, activity_date: '2026-11-08', title: '週日排球', pickup_label: '週日臨打', notification_type: 'pickup' },
          { season_id: 7, activity_date_id: 42, activity_date: '2026-11-08', title: '週日排球', pickup_label: null, notification_type: 'season' },
        ],
        error: null,
      }
    },
  }
  assert.deepEqual(await listOpenedPickupSessions(supabase, now), [opening])
})

test('announces members currently on leave when pickup registration opens', () => {
  const page = {
    activity: { selected_activity_date_id: 42, selected_activity_date: '2026-11-08', dates: ['2026-08-02', '2026-11-08'], single_capacity: 8 },
    season_registrations: [
      { user_id: 'season-1', display_name: '小明', season_plan: 'late-quarter', is_self_registration: true, cancelled_at: null, leave_dates: ['2026-11-08'] },
      { user_id: 'season-2', display_name: '小華', season_plan: 'half-year', is_self_registration: true, cancelled_at: null, leave_dates: ['2026-11-08'] },
      { user_id: 'other-plan', display_name: '不涵蓋', season_plan: 'quarter', is_self_registration: true, cancelled_at: null, leave_dates: ['2026-11-08'] },
      { user_id: 'cancelled-season', display_name: '已取消', season_plan: 'half-year', is_self_registration: true, cancelled_at: '2026-10-20', leave_dates: ['2026-11-08'] },
      { user_id: 'present-season', display_name: '尚未請假', season_plan: 'half-year', is_self_registration: true, cancelled_at: null, leave_dates: [] },
    ],
    pickup_registrations: [],
  }

  assert.deepEqual(buildOpenLeaveReminder(opening, page), {
    type: 'text',
    text: '【臨打報名已開放】\n週日臨打\n日期：2026-11-08\n目前請假 2 人\n季打：小明、小華\n目前缺 7 人',
  })
})

test('ignores pickup cancellations when announcing season leave', () => {
  const page = {
    activity: { selected_activity_date_id: 42, selected_activity_date: '2026-11-08', dates: ['2026-11-08'], single_capacity: 6 },
    season_registrations: [],
    pickup_registrations: [{ user_id: 'pickup-1', display_name: '小李', is_self_registration: true, cancelled_at: '2026-10-20', guests: [{ name: '阿美', cancelled_at: '2026-10-20' }] }],
  }
  assert.equal(buildOpenLeaveReminder(opening, page).text, '【臨打報名已開放】\n週日臨打\n日期：2026-11-08\n目前請假 0 人\n季打：無\n目前缺 6 人')
})

test('rejects a page for a different activity date', () => {
  const page = { activity: { selected_activity_date_id: 41, selected_activity_date: '2026-11-01' }, season_registrations: [] }
  assert.throws(() => buildOpenLeaveReminder(opening, page), /activity_date_not_found/)
})
