import { supabase } from '~/utils/supabase'

export async function syncMemberProfile({ userId, displayName, lineAccessToken }) {
  if (!userId) return null

  if (import.meta.env.DEV) {
    const { data, error } = await supabase.from('members').select('role, gender, is_season').eq('user_id', userId).maybeSingle()
    if (error) return null
    if (data) {
      return {
        role: data.role,
        gender: data.gender || null,
        isSeason: data.is_season ?? false,
      }
    }

    await supabase.from('members').insert({ user_id: userId, display_name: displayName, role: 'member' })
    return { role: 'member', gender: null, isSeason: false }
  }

  if (!lineAccessToken) return null
  const { data, error } = await supabase.functions.invoke('member-profile', {
    body: { action: 'sync' },
    headers: { 'x-line-access-token': lineAccessToken },
  })
  if (error) throw error
  return {
    role: data?.role ?? 'member',
    gender: data?.gender ?? null,
    isSeason: data?.isSeason ?? false,
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
