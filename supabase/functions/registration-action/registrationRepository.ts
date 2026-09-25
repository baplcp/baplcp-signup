export const REGISTRATION_FIELDS =
  'id, season_id, activity_date_id, member_id, cancelled_at, created_at, paid_court, paid_ac, season_plan, member:members!registrations_member_id_fkey(user_id, display_name, picture_url)'

export type Registration = Record<string, any>

function hydrateMemberProfile(registration: Registration | null | undefined) {
  if (!registration) return registration
  const member = Array.isArray(registration.member) ? registration.member[0] : registration.member
  return {
    ...registration,
    user_id: member?.user_id ?? null,
    display_name: member?.display_name ?? null,
    picture_url: member?.picture_url ?? null,
  }
}

export async function hydrateRegistrationCollections(registration: Registration | null | undefined) {
  if (!registration) return registration
  return hydrateMemberProfile(registration)
}

export async function findRegistration(
  supabase: any,
  { activityId, memberId, activityDateId, activeOnly = true }: { activityId: string | number; memberId: string; activityDateId: number | null; activeOnly?: boolean }
) {
  let query = supabase.from('registrations').select(REGISTRATION_FIELDS).eq('season_id', activityId).eq('member_id', memberId)
  if (activeOnly) query = query.is('cancelled_at', null)
  query = activityDateId === null ? query.is('activity_date_id', null) : query.eq('activity_date_id', activityDateId)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return hydrateRegistrationCollections(data)
}

export async function syncRegistrationMember(supabase: any, profile: { userId: string; displayName: string; pictureUrl?: string | null }) {
  const { data: existing, error: findError } = await supabase.from('members').select('id').eq('user_id', profile.userId).maybeSingle()
  if (findError) throw findError

  if (existing) {
    const { error } = await supabase
      .from('members')
      .update({ display_name: profile.displayName, picture_url: profile.pictureUrl ?? null })
      .eq('id', existing.id)
    if (error) throw error
    return existing.id as string
  }

  const { data, error } = await supabase
    .from('members')
    .insert({ user_id: profile.userId, display_name: profile.displayName, picture_url: profile.pictureUrl ?? null, role: 'member' })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function saveRegistrationAction(
  supabase: any,
  {
    profile,
    activityId,
    activityDate,
    selfCount,
    guestCount,
    guests,
    submitTime,
  }: {
    profile: { userId: string; displayName: string; pictureUrl?: string | null }
    activityId: string | number
    activityDate: string | null
    selfCount: number
    guestCount: number
    guests: Array<{ id?: string; name: string; gender: string }>
    submitTime: string
  }
) {
  const { error } = await supabase.rpc('save_registration_action_v1', {
    p_user_id: profile.userId,
    p_display_name: profile.displayName,
    p_picture_url: profile.pictureUrl ?? null,
    p_activity_id: activityId,
    p_activity_date: activityDate,
    p_self_count: selfCount,
    p_guest_count: guestCount,
    p_guests: guests,
    p_submit_time: submitTime,
  })
  if (error) throw error
}

export async function findRegistrationById(supabase: any, registrationId: string | number) {
  const { data, error } = await supabase.from('registrations').select(REGISTRATION_FIELDS).eq('id', registrationId).maybeSingle()
  if (error) throw error
  return hydrateRegistrationCollections(data)
}

export async function writeRegistration(supabase: any, registrationId: string | null, payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('write_registration_v3', {
    p_registration_id: registrationId,
    p_payload: payload,
  })
  if (error) throw error
  return data as string
}

export async function writeRegistrationGuests(supabase: any, payload: Record<string, unknown>) {
  const { error } = await supabase.rpc('write_registration_guests_v1', payload)
  if (error) throw error
}

export async function updateRegistrationGuest(supabase: any, guestId: string, payload: Record<string, unknown>) {
  const { error } = await supabase.rpc('update_registration_guest_v1', {
    p_guest_id: guestId,
    p_payload: payload,
  })
  if (error) throw error
}

export async function setSeasonRegistrationDateStatus(supabase: any, registrationId: string, activityDateId: number, isOnLeave: boolean, changedAt: string) {
  const { error } = await supabase.rpc('set_season_registration_date_status_v3', {
    p_registration_id: registrationId,
    p_activity_date_id: activityDateId,
    p_is_on_leave: isOnLeave,
    p_changed_at: changedAt,
  })
  if (error) throw error
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505'
}

export async function writeRegistrationWithRetry(
  supabase: any,
  {
    existing,
    createPayload,
    findAfterConflict,
  }: {
    existing: Registration | null | undefined
    createPayload: (registration: Registration | null | undefined) => Record<string, unknown>
    findAfterConflict: () => Promise<Registration | null | undefined>
  }
) {
  try {
    await writeRegistration(supabase, existing?.id ?? null, createPayload(existing))
  } catch (error) {
    if (!isUniqueViolation(error)) throw error

    const retryRegistration = await findAfterConflict()
    if (!retryRegistration) throw error
    await writeRegistration(supabase, retryRegistration.id, createPayload(retryRegistration))
  }
}

export async function getActivityForRegistration(supabase: any, activityId: string | number) {
  const { data, error } = await supabase
    .from('seasons')
    .select(
      'id, season_enabled, season_open_date, season_open_time, season_close_date, season_close_time, season_late_enabled, season_late_open_date, season_late_open_time, season_late_close_date, season_late_close_time, pickup_open_days_before, pickup_open_time, pickup_deadline_type, pickup_close_days_before, pickup_close_time'
    )
    .eq('id', activityId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('activity_not_found')
  return data
}
