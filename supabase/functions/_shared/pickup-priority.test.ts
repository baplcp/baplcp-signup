import { pickupGuestPriorityCutoff, pickupSecondGuestCutoff, sortPickupParticipants } from './pickup-priority.ts'

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

Deno.test('cutoff is two hours after pickup opens', () => {
  // 2026-10-11 提前 7 天（10/4）20:00 開放，群內優先到 22:00（台灣時間）。
  assertEquals(pickupGuestPriorityCutoff('2026-10-11', 7, '20:00:00')?.toISOString(), '2026-10-04T14:00:00.000Z')
})

Deno.test('dates that opened before 2026-10-04 12:00 keep the first Tuesday 23:59 cutoff', () => {
  // 2026-10-10 提前 7 天（10/3）20:00 開放，第一個星期二是 10/6。
  assertEquals(pickupGuestPriorityCutoff('2026-10-10', 7, '20:00:00')?.toISOString(), '2026-10-06T16:00:00.000Z')
  // 2026-10-11 當天 10:00 開放，仍早於生效時間。
  assertEquals(pickupGuestPriorityCutoff('2026-10-11', 7, '10:00:00')?.toISOString(), '2026-10-06T16:00:00.000Z')
})

Deno.test('activities without a pickup open time fall back to the Tuesday before the activity date', () => {
  assertEquals(pickupGuestPriorityCutoff('2026-10-17', null, null)?.toISOString(), '2026-10-13T16:00:00.000Z')
})

Deno.test('second guest cutoff stays the first Tuesday 23:59 after pickup opens', () => {
  // 2026-10-11 提前 7 天（10/4 星期日）開放，第一個星期二是 10/6。
  assertEquals(pickupSecondGuestCutoff('2026-10-11', 7)?.toISOString(), '2026-10-06T16:00:00.000Z')
  assertEquals(pickupSecondGuestCutoff('2026-09-27', 7), null)
})

Deno.test('activity dates before October 2026 keep pure time order', () => {
  assertEquals(pickupGuestPriorityCutoff('2026-09-27', 7, '20:00:00'), null)
})

Deno.test('members registered before the cutoff come before guests; later signups keep time order', () => {
  const cutoff = new Date('2026-09-27T13:00:00.000Z')
  const sorted = sortPickupParticipants(
    [
      { id: 'guest-early', ts: '2026-09-27T12:01:00.000Z', isGuest: true },
      { id: 'member-before-cutoff', ts: '2026-09-27T12:30:00.000Z', isGuest: false },
      { id: 'guest-after-cutoff', ts: '2026-09-27T13:05:00.000Z', isGuest: true },
      { id: 'member-after-cutoff', ts: '2026-09-27T14:00:00.000Z', isGuest: false },
    ],
    cutoff
  )
  assertEquals(
    sorted.map(entry => entry.id),
    ['member-before-cutoff', 'guest-early', 'guest-after-cutoff', 'member-after-cutoff']
  )
})
