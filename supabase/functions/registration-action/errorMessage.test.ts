import { errorMessage } from './errorMessage.ts'

Deno.test('errorMessage preserves a PostgREST error message', () => {
  const message = errorMessage({ code: 'P0001', message: 'season_capacity_exceeded' })
  if (message !== 'season_capacity_exceeded') throw new Error('expected the database error message to be preserved')
})

Deno.test('errorMessage falls back for unknown thrown values', () => {
  if (errorMessage({ code: 'unknown' }) !== 'internal_error') throw new Error('expected the internal error fallback')
})
