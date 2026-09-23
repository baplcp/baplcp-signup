import { saveRegistrationAction, writeRegistrationWithRetry } from './registrationRepository.ts'

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

Deno.test('saveRegistrationAction sends the complete signup to one RPC', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const supabase = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      return Promise.resolve({ error: null })
    },
  }

  await saveRegistrationAction(supabase, {
    profile: { userId: 'line-user-id', displayName: '小明', pictureUrl: null },
    activityId: 42,
    activityDate: '2026-10-04',
    selfCount: 1,
    guestCount: 1,
    guests: [{ name: '小華', gender: 'female' }],
    submitTime: '2026-10-01T00:00:00.000Z',
  })

  if (calls.length !== 1 || calls[0].name !== 'save_registration_action_v1') {
    throw new Error('expected exactly one registration action RPC')
  }
  if (calls[0].args.p_guest_count !== 1 || calls[0].args.p_activity_date !== '2026-10-04') {
    throw new Error('expected the RPC to receive the normalized signup payload')
  }
})
