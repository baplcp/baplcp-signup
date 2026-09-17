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

export function parseTaiwanDateTime(dateString, timeString) {
  const [year, month, day] = dateString.split('-').map(Number)
  const [hour, minute, second = 0] = timeString.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second))
}
