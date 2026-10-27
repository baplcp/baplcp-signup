import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchLeaveSessionPage, hasActivePickupSelf, sendLeaveNotification, sessionVacancy } from './leaveNotification.ts'

test('sends a season leave reminder to the notification group', async () => {
  const originalFetch = globalThis.fetch
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return { ok: true }
  }

  try {
    await sendLeaveNotification('sub-token', 'notify-group', '小明', 'season', '週五排球', '2026-10-30', 3)
    assert.equal(request.url, 'https://api.line.me/v2/bot/message/push')
    assert.equal(request.options.headers.Authorization, 'Bearer sub-token')
    assert.deepEqual(JSON.parse(request.options.body), {
      to: 'notify-group',
      messages: [{ type: 'text', text: '【季打請假提醒】\n小明 已請假\n球局：週五排球\n日期：2026-10-30\n目前缺 3 人' }],
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('reports a failed LINE push', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, text: async () => 'invalid group' })

  try {
    await assert.rejects(sendLeaveNotification('sub-token', 'notify-group', '小明', 'pickup', '週五排球', '2026-10-30', 2), /LINE push failed: invalid group/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('counts only active people on the selected date, including guest-only signups', () => {
  const page = {
    activity: { single_capacity: 6, selected_activity_date: '2026-10-30', dates: ['2026-07-03', '2026-10-30'] },
    pickup_registrations: [
      { user_id: 'member-1', is_self_registration: true, cancelled_at: null, guests: [{ cancelled_at: null }, { cancelled_at: '2026-10-28' }] },
      { user_id: 'member-2', is_self_registration: true, cancelled_at: '2026-10-28', guests: [] },
      { user_id: 'guest-owner', is_self_registration: false, cancelled_at: null, guests: [{ cancelled_at: null }] },
    ],
    season_registrations: [
      { season_plan: 'quarter', is_self_registration: true, cancelled_at: null, leave_dates: [] },
      { season_plan: 'late-quarter', is_self_registration: true, cancelled_at: null, leave_dates: [] },
      { season_plan: 'half-year', is_self_registration: true, cancelled_at: null, leave_dates: ['2026-10-30'] },
    ],
  }

  assert.equal(hasActivePickupSelf(page, 'member-1'), true)
  assert.equal(hasActivePickupSelf(page, 'member-2'), false)
  assert.equal(hasActivePickupSelf(page, 'guest-owner'), false)
  assert.equal(sessionVacancy(page), 2)
})

test('reads the requested session for the post-leave vacancy', async () => {
  const page = { activity: { selected_activity_date_id: 42, selected_activity_date: '2026-10-30' } }
  const supabase = {
    rpc: async (name, args) => {
      assert.equal(name, 'get_activity_page')
      assert.deepEqual(args, { p_activity_id: 7, p_activity_date_id: 42 })
      return { data: page, error: null }
    },
  }

  assert.equal(await fetchLeaveSessionPage(supabase, 7, 42, '2026-10-30'), page)
  await assert.rejects(fetchLeaveSessionPage(supabase, 7, 42, '2026-10-31'), /activity_date_not_found/)
})

test('pickup leave message includes the current vacancy', async () => {
  const originalFetch = globalThis.fetch
  let message
  globalThis.fetch = async (_url, options) => {
    message = JSON.parse(options.body).messages[0].text
    return { ok: true }
  }

  try {
    await sendLeaveNotification('sub-token', 'notify-group', '小華', 'pickup', '週五排球', '2026-10-30', 2)
    assert.equal(message, '【臨打請假提醒】\n小華 已請假\n球局：週五排球\n日期：2026-10-30\n目前缺 2 人')
  } finally {
    globalThis.fetch = originalFetch
  }
})
