const TAIWAN_TIME_ZONE = 'Asia/Taipei'

function getDatePart(date, type) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TAIWAN_TIME_ZONE,
    [type]: '2-digit',
  })
    .formatToParts(date)
    .find(part => part.type === type)?.value
}

export function getTaiwanDateString(date = new Date()) {
  const year = new Intl.DateTimeFormat('en-US', {
    timeZone: TAIWAN_TIME_ZONE,
    year: 'numeric',
  })
    .formatToParts(date)
    .find(part => part.type === 'year')?.value
  const month = getDatePart(date, 'month')
  const day = getDatePart(date, 'day')
  return `${year}-${month}-${day}`
}

export function parseTaiwanDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function formatTaiwanDate(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addTaiwanDays(dateString, days) {
  const date = parseTaiwanDate(dateString)
  date.setUTCDate(date.getUTCDate() + days)
  return formatTaiwanDate(date)
}

export function getTaiwanWeekday(dateString) {
  return parseTaiwanDate(dateString).getUTCDay()
}

export function parseTaiwanDateTime(dateString, timeString) {
  const [year, month, day] = dateString.split('-').map(Number)
  const [hour, minute, second = 0] = timeString.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second))
}

export function formatTaiwanTime(timeString) {
  const time = (timeString || '').slice(0, 5)
  return time.replace(/^0/, '')
}
