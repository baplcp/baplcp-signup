import { addTaiwanDays, getTaiwanDateAndHour, parseTaiwanDateTime } from './taiwan-date.ts'

Deno.test('parseTaiwanDateTime converts Taiwan civil time to UTC', () => {
  const date = parseTaiwanDateTime('2026-01-01', '00:30')
  if (date.toISOString() !== '2025-12-31T16:30:00.000Z') throw new Error('expected Taiwan midnight to be converted using UTC+8')
})

Deno.test('parseTaiwanDateTime preserves seconds returned by PostgreSQL time columns', () => {
  const date = parseTaiwanDateTime('2026-01-01', '06:00:30')
  if (date.toISOString() !== '2025-12-31T22:00:30.000Z') throw new Error('expected PostgreSQL time seconds to be preserved')
})

Deno.test('addTaiwanDays keeps date arithmetic across a year boundary', () => {
  if (addTaiwanDays('2026-01-01', -1) !== '2025-12-31') throw new Error('expected previous date across year boundary')
  if (addTaiwanDays('2026-12-31', 1) !== '2027-01-01') throw new Error('expected next date across year boundary')
})

Deno.test('getTaiwanDateAndHour derives the Taiwan date and hour from a UTC instant', () => {
  const taiwanTime = getTaiwanDateAndHour(new Date('2025-12-31T16:30:00.000Z'))
  if (taiwanTime.date !== '2026-01-01' || taiwanTime.hour !== 0) throw new Error('expected Taiwan date and hour')
})
