type ActivityDate = {
  id: number
  activity_id: number
  activity_date: string
  sort_order: number
}

type SeasonRegistrationDateStatus = {
  registration_id: string
  is_on_leave: boolean
  rejoined_at: string | null
}

type RegistrationGuest = {
  registration_id: string
  guest_position: number
  display_name: string | null
  gender: string | null
  joined_at: string | null
  paid_court: boolean
  paid_ac: boolean
  legacy_payload: Record<string, unknown>
}

type RegistrationCancellationEvent = {
  registration_id: string
  participant_type: 'self' | 'guest'
  guest_display_name: string | null
  participant_added_at: string | null
  member: { display_name: string | null; picture_url: string | null } | Array<{ display_name: string | null; picture_url: string | null }>
}

function uniqueIds(ids: Array<number | string | null | undefined>) {
  return [...new Set(ids.filter((id): id is number | string => id !== null && id !== undefined))]
}

export async function fetchActiveActivityDates(supabase: any, activityIds: Array<number | string | null | undefined>): Promise<ActivityDate[]> {
  const ids = uniqueIds(activityIds)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('activity_dates')
    .select('id, activity_id, activity_date, sort_order')
    .in('activity_id', ids)
    .eq('is_active', true)
    .order('activity_id', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data || []) as ActivityDate[]
}

export function groupActivityDatesByActivityId(activityDates: ActivityDate[]) {
  return activityDates.reduce((datesByActivityId, activityDate) => {
    const dates = datesByActivityId.get(activityDate.activity_id) || []
    dates.push(activityDate)
    datesByActivityId.set(activityDate.activity_id, dates)
    return datesByActivityId
  }, new Map<number, ActivityDate[]>())
}

export async function fetchActivityDateId(supabase: any, activityId: number | string, activityDate: string) {
  const { data, error } = await supabase.from('activity_dates').select('id').eq('activity_id', activityId).eq('activity_date', activityDate).maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function fetchSeasonRegistrationDateStatuses(supabase: any, registrationIds: Array<string | null | undefined>, activityDateId: number) {
  const ids = uniqueIds(registrationIds)
  if (ids.length === 0) return new Map<string, SeasonRegistrationDateStatus>()

  const { data, error } = await supabase.from('season_registration_date_statuses').select('registration_id, is_on_leave, rejoined_at').in('registration_id', ids).eq('activity_date_id', activityDateId)
  if (error) throw error

  return new Map((data || []).map((status: SeasonRegistrationDateStatus) => [status.registration_id, status]))
}

export async function fetchRegistrationGuests(supabase: any, registrationIds: Array<string | null | undefined>) {
  const ids = uniqueIds(registrationIds)
  if (ids.length === 0) return new Map<string, RegistrationGuest[]>()

  const { data, error } = await supabase
    .from('registration_guests')
    .select('registration_id, guest_position, display_name, gender, joined_at, paid_court, paid_ac, legacy_payload')
    .in('registration_id', ids)
    .order('guest_position', { ascending: true })
  if (error) throw error

  return (data || []).reduce((guestsByRegistrationId: Map<string, RegistrationGuest[]>, guest: RegistrationGuest) => {
    const guests = guestsByRegistrationId.get(guest.registration_id) || []
    guests.push(guest)
    guestsByRegistrationId.set(guest.registration_id, guests)
    return guestsByRegistrationId
  }, new Map<string, RegistrationGuest[]>())
}

export async function fetchRegistrationCancelledMemberSnapshots(supabase: any, registrationIds: Array<string | null | undefined>) {
  const ids = uniqueIds(registrationIds)
  if (ids.length === 0) return new Map<string, Record<string, unknown>[]>()

  const { data, error } = await supabase
    .from('registration_cancellation_events')
    .select('registration_id, participant_type, guest_display_name, participant_added_at, member:members!registration_cancellation_events_member_id_fkey(display_name, picture_url)')
    .in('registration_id', ids)
    .eq('legacy_source', 'cancelled_members')
    .order('legacy_position', { ascending: true })
  if (error) throw error

  return (data || []).reduce((snapshotsByRegistrationId: Map<string, Record<string, unknown>[]>, event: RegistrationCancellationEvent) => {
    const snapshots = snapshotsByRegistrationId.get(event.registration_id) || []
    const member = Array.isArray(event.member) ? event.member[0] : event.member
    const name = event.participant_type === 'guest' ? event.guest_display_name || '群外' : member?.display_name || '未命名'
    snapshots.push({
      name,
      badge: name.charAt(0),
      image: event.participant_type === 'self' ? member?.picture_url || null : null,
      time: event.participant_added_at || null,
      addedBy: event.participant_type === 'guest' ? member?.display_name || null : null,
    })
    snapshotsByRegistrationId.set(event.registration_id, snapshots)
    return snapshotsByRegistrationId
  }, new Map<string, Array<Record<string, unknown>>>())
}
