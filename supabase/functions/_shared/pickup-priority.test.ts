import { pickupGuestPriorityCutoff, sortPickupParticipants } from './pickup-priority.ts'

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

Deno.test('cutoff is the first Tuesday 23:59 after pickup opens', () => {
  // 2026-10-04 是星期日，提前 7 天（9/27 星期日）開放，第一個星期二是 9/29。
  assertEquals(pickupGuestPriorityCutoff('2026-10-04', 7)?.toISOString(), '2026-09-29T16:00:00.000Z')
})

Deno.test('cutoff falls back to the Tuesday before the activity date', () => {
  assertEquals(pickupGuestPriorityCutoff('2026-10-03', null)?.toISOString(), '2026-09-29T16:00:00.000Z')
})

Deno.test('activity dates before October 2026 keep pure time order', () => {
  assertEquals(pickupGuestPriorityCutoff('2026-09-27', 7), null)
})

Deno.test('members registered before the cutoff come before guests; later signups keep time order', () => {
  const cutoff = new Date('2026-09-29T16:00:00.000Z')
  const sorted = sortPickupParticipants(
    [
      { id: 'guest-early', ts: '2026-09-27T12:00:00.000Z', isGuest: true },
      { id: 'member-before-cutoff', ts: '2026-09-28T12:00:00.000Z', isGuest: false },
      { id: 'guest-after-cutoff', ts: '2026-09-30T01:00:00.000Z', isGuest: true },
      { id: 'member-after-cutoff', ts: '2026-09-30T02:00:00.000Z', isGuest: false },
    ],
    cutoff
  )
  assertEquals(
    sorted.map(entry => entry.id),
    ['member-before-cutoff', 'guest-early', 'guest-after-cutoff', 'member-after-cutoff']
  )
})
