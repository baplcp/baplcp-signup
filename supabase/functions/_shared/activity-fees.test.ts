import { calculateSeasonTotals } from './activity-fees.ts'

Deno.test('calculateSeasonTotals uses unique dates and applies AC only when included', () => {
  const dates = ['2026-01-31', '2026-02-07', '2026-03-07', '2026-04-04', '2026-04-04']

  const withAc = calculateSeasonTotals(dates, 100, 80, 20, true)
  const withoutAc = calculateSeasonTotals(dates, 100, 80, 20, false)

  if (withAc.quarter !== 360 || withAc.halfYear !== 400) throw new Error('expected totals with AC')
  if (withoutAc.quarter !== 300 || withoutAc.halfYear !== 320) throw new Error('expected totals without AC')
})

Deno.test('calculateSeasonTotals keeps the quarter boundary across a year change', () => {
  const totals = calculateSeasonTotals(['2026-12-05', '2027-01-02', '2027-02-06', '2027-03-06'], 100, 100, 0, false)

  if (totals.quarter !== 300 || totals.halfYear !== 400) throw new Error('expected totals across a year change')
})
