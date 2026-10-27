import assert from 'node:assert/strict'
import test from 'node:test'
import { sendSeasonLeaveNotification } from './seasonLeaveNotification.ts'

test('sends a season leave reminder to the notification group', async () => {
  const originalFetch = globalThis.fetch
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return { ok: true }
  }

  try {
    await sendSeasonLeaveNotification('sub-token', 'notify-group', '小明', '週五排球', '2026-10-30')
    assert.equal(request.url, 'https://api.line.me/v2/bot/message/push')
    assert.equal(request.options.headers.Authorization, 'Bearer sub-token')
    assert.deepEqual(JSON.parse(request.options.body), {
      to: 'notify-group',
      messages: [{ type: 'text', text: '【季打請假提醒】\n小明 已請假\n球局：週五排球\n日期：2026-10-30' }],
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('reports a failed LINE push', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, text: async () => 'invalid group' })

  try {
    await assert.rejects(sendSeasonLeaveNotification('sub-token', 'notify-group', '小明', '週五排球', '2026-10-30'), /LINE push failed: invalid group/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
