import { writeRegistrationWithRetry } from './registrationRepository.ts'

Deno.test('writeRegistrationWithRetry retries a unique conflict with the refreshed registration', async () => {
  const writes: Array<{ p_registration_id: string | null; p_payload: Record<string, unknown> }> = []
  const supabase = {
    rpc: (_name: string, args: { p_registration_id: string | null; p_payload: Record<string, unknown> }) => {
      writes.push(args)
      return Promise.resolve(writes.length === 1 ? { data: null, error: { code: '23505' } } : { data: 'registration-id', error: null })
    },
  }
  let refreshes = 0

  await writeRegistrationWithRetry(supabase, {
    existing: null,
    createPayload: registration => ({ registration_id: registration?.id ?? null }),
    findAfterConflict: async () => {
      refreshes += 1
      return { id: 'registration-id' }
    },
  })

  if (refreshes !== 1) throw new Error('expected one refresh after the unique conflict')
  if (writes.length !== 2 || writes[0].p_registration_id !== null || writes[1].p_registration_id !== 'registration-id') {
    throw new Error('expected a create attempt followed by an update')
  }
})

Deno.test('writeRegistrationWithRetry applies the same retry policy to an existing registration', async () => {
  const writes: Array<{ p_registration_id: string | null; p_payload: Record<string, unknown> }> = []
  const supabase = {
    rpc: (_name: string, args: { p_registration_id: string | null; p_payload: Record<string, unknown> }) => {
      writes.push(args)
      return Promise.resolve(writes.length === 1 ? { data: null, error: { code: '23505' } } : { data: 'current-registration', error: null })
    },
  }

  await writeRegistrationWithRetry(supabase, {
    existing: { id: 'stale-registration' },
    createPayload: registration => ({ registration_id: registration?.id ?? null }),
    findAfterConflict: async () => ({ id: 'current-registration' }),
  })

  if (writes.length !== 2) throw new Error(`expected two writes, got ${writes.length}`)
  if (writes[0].p_registration_id !== 'stale-registration') throw new Error('expected the existing registration to be written first')
  if (writes[1].p_registration_id !== 'current-registration') throw new Error('expected retry to use the refreshed registration')
})
