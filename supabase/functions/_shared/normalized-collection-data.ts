type ActivityDate = {
  id: number
  season_id: number
  activity_date: string
  sort_order: number
}

type SeasonRegistrationDateStatus = {
  registration_id: string
  is_on_leave: boolean
  rejoined_at: string | null
}

type RegistrationGuest = {
  id: string
  activity_date_id: number
  invited_by: string
  display_name: string | null
  gender: string | null
  created_at: string
  cancelled_at: string | null
  paid_court: boolean
  paid_ac: boolean
}

function uniqueIds(ids: Array<number | string | null | undefined>) {
  return [...new Set(ids.filter((id): id is number | string => id !== null && id !== undefined))]
}

export async function fetchActiveActivityDates(supabase: any, activityIds: Array<number | string | null | undefined>): Promise<ActivityDate[]> {
  const ids = uniqueIds(activityIds)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('activity_dates')
    .select('id, season_id, activity_date, sort_order')
    .in('season_id', ids)
    .eq('is_active', true)
    .order('season_id', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data || []) as ActivityDate[]
}

export function groupActivityDatesByActivityId(activityDates: ActivityDate[]) {
  return activityDates.reduce((datesByActivityId, activityDate) => {
    const dates = datesByActivityId.get(activityDate.season_id) || []
    dates.push(activityDate)
    datesByActivityId.set(activityDate.season_id, dates)
    return datesByActivityId
  }, new Map<number, ActivityDate[]>())
}

export async function fetchActivityDateId(supabase: any, activityId: number | string, activityDate: string) {
  const { data, error } = await supabase.from('activity_dates').select('id').eq('season_id', activityId).eq('activity_date', activityDate).maybeSingle()
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

export async function fetchRegistrationGuests(supabase: any, activityDateId: number) {
  const { data, error } = await supabase
    .from('registration_guests')
    .select('id, activity_date_id, invited_by, display_name, gender, created_at, cancelled_at, paid_court, paid_ac')
    .eq('activity_date_id', activityDateId)
    .is('cancelled_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error

  return (data || []) as RegistrationGuest[]
}
