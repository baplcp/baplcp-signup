const TAIWAN_UTC_OFFSET_HOURS = 8

export function parseTaiwanDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hour - TAIWAN_UTC_OFFSET_HOURS, minute, 0))
}

export function addTaiwanDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function getTaiwanDateAndHour(now = new Date()): { date: string; hour: number } {
  const taiwanNow = new Date(now.getTime() + TAIWAN_UTC_OFFSET_HOURS * 60 * 60 * 1000)
  const year = taiwanNow.getUTCFullYear()
  const month = String(taiwanNow.getUTCMonth() + 1).padStart(2, '0')
  const day = String(taiwanNow.getUTCDate()).padStart(2, '0')
  return { date: `${year}-${month}-${day}`, hour: taiwanNow.getUTCHours() }
}
