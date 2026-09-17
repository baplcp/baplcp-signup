function formatDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calculateSeasonTotals(dates: string[], seasonFee: number, halfYearFee: number, acFee: number, includesAc: boolean) {
  const sortedDates = [...new Set(dates)].sort()
  const [year, month] = sortedDates[0].split('-').map(Number)
  const quarterCutoff = formatDate(new Date(Date.UTC(year, month + 2, 1)))
  const acIncludedFee = includesAc ? acFee : 0

  return {
    quarter: (seasonFee + acIncludedFee) * sortedDates.filter(date => date < quarterCutoff).length,
    halfYear: (halfYearFee + acIncludedFee) * sortedDates.length,
  }
}
