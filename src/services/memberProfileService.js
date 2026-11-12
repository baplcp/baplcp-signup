import { supabase } from '~/utils/supabase'

export async function syncMemberProfile({ userId, displayName, lineAccessToken, includeParticipationCount = false }) {
  if (!userId) return null

  if (import.meta.env.DEV) {
    const { data, error } = await supabase.from('members').select('id, role, gender, approved_at').eq('user_id', userId).maybeSingle()
    if (error) return null
    if (data) {
      const { data: seasonRegistration, error: registrationError } = await supabase
        .from('registrations')
        .select('id')
        .eq('member_id', data.id)
        .is('activity_date_id', null)
        .is('cancelled_at', null)
        .limit(1)
        .maybeSingle()
      if (registrationError) return null
      return {
        role: data.role,
        gender: data.gender || null,
        approvedAt: data.approved_at,
        isSeason: !!seasonRegistration,
      }
    }

    const { error: insertError } = await supabase.from('members').insert({ user_id: userId, display_name: displayName, role: 'member' })
    if (insertError) throw insertError
    return { role: 'member', gender: null, approvedAt: null, isSeason: false }
  }

  if (!lineAccessToken) return null
  const { data, error } = await supabase.functions.invoke('member-profile', {
    body: { action: 'sync', includeParticipationCount },
    headers: { 'x-line-access-token': lineAccessToken },
  })
  if (error) throw error
  return {
    role: data?.role ?? 'member',
    gender: data?.gender ?? null,
    approvedAt: data?.approvedAt ?? null,
    isSeason: data?.isSeason ?? false,
    participationCount: data?.participationCount ?? null,
  }
}

export async function updateMemberGender({ userId, gender, lineAccessToken }) {
  if (!userId) return false

  if (import.meta.env.DEV) {
    const { error } = await supabase.from('members').update({ gender }).eq('user_id', userId)
    return !error
  }

  if (!lineAccessToken) return false
  const { error } = await supabase.functions.invoke('member-profile', {
    body: { action: 'update-gender', gender },
    headers: { 'x-line-access-token': lineAccessToken },
  })
  return !error
}
