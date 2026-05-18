import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getTaiwanNow(): { date: string; hour: number } {
  const now = new Date()
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const y = tw.getUTCFullYear()
  const m = String(tw.getUTCMonth() + 1).padStart(2, '0')
  const d = String(tw.getUTCDate()).padStart(2, '0')
  return { date: `${y}-${m}-${d}`, hour: tw.getUTCHours() }
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

async function pushMessage(token: string, groupId: string, message: Record<string, unknown>): Promise<void> {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: groupId, messages: [message] }),
  })
  if (!res.ok) throw new Error(`LINE push failed: ${await res.text()}`)
}

// 逐一找出不在群組的 key，換成純文字後重試，其餘人維持 @mention
async function sendWithGranularFallback(
  token: string,
  groupId: string,
  text: string,
  substitution: Record<string, unknown>,
  fallbackNames: Record<string, string>
): Promise<void> {
  let currentText = text
  const sub = { ...substitution }
  const maxRetries = Object.keys(substitution).length + 1

  for (let i = 0; i <= maxRetries; i++) {
    try {
      await pushMessage(token, groupId, { type: 'textV2', text: currentText, substitution: sub })
      return
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('not found in the group')) throw e

      // 從錯誤訊息找出哪個 key 失敗，例如 substitution["m3"].mentionee
      const match = msg.match(/substitution\[(?:\\?")?([^"\\[\]]+)/)
      if (!match) throw e
      const failedKey = match[1].replace(/\\?"/g, '')
      const plainName = fallbackNames[failedKey]
      if (plainName === undefined) throw e

      console.warn(`User key ${failedKey} not in group, replacing with plain text: ${plainName}`)
      currentText = currentText.replace(`{${failedKey}}`, plainName)
      delete sub[failedKey]
    }
  }
  throw new Error('Too many retries replacing group mentions')
}

type ConfirmedUser = { userId: string; displayName: string; guestCount: number; guests: Array<{ gender?: string }> }

serve(async (_req) => {
  try {
    const lineToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
    const lineGroupId = Deno.env.get('LINE_GROUP_ID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!lineToken || !lineGroupId) return new Response('Missing LINE config', { status: 500 })

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { date: todayTw, hour: hourTw } = getTaiwanNow()

    const { data: activities, error: actErr } = await supabase
      .from('activities')
      .select('id, title, pickup_label, location, start_time, single_capacity, pickup_fee_per_session, ac_enabled, ac_fee, dates, reminder_enabled, reminder_days_before, reminder_time')
      .eq('reminder_enabled', true)
    if (actErr) throw actErr

    const { data: organizers } = await supabase
      .from('members').select('user_id, display_name').eq('role', 'organizer')

    let notified = 0

    for (const activity of activities ?? []) {
      if (!activity.reminder_days_before || !activity.reminder_time) continue

      // 確認目前小時符合提醒時間（只取小時）
      const reminderHour = parseInt(activity.reminder_time.slice(0, 2), 10)
      if (hourTw !== reminderHour) continue

      const dates: string[] = Array.isArray(activity.dates)
        ? activity.dates
        : typeof activity.dates === 'string' ? JSON.parse(activity.dates) : []

      // 找出「今天 + reminder_days_before 天」是哪些場次日期
      const targetDates = dates.filter(d => addDays(todayTw, activity.reminder_days_before) === d)
      if (targetDates.length === 0) continue

      for (const targetDate of targetDates) {
        // ── 臨打報名 ──────────────────────────────────────────────
        const { data: pickupRegs, error: pErr } = await supabase
          .from('registrations')
          .select('user_id, display_name, guests, self_added_at')
          .eq('activity_id', activity.id).eq('activity_date', targetDate).eq('status', 'active')
          .order('self_added_at', { ascending: true, nullsFirst: false })
        if (pErr) throw pErr

        const pickupCapacity = Number(activity.single_capacity) || 0
        const confirmedPickup: ConfirmedUser[] = []
        let slotCount = 0
        for (const reg of pickupRegs ?? []) {
          if (pickupCapacity > 0 && slotCount >= pickupCapacity) break
          const allGuests = (reg.guests as Array<{ gender?: string }>) ?? []
          const confirmedGuestCount = pickupCapacity > 0
            ? Math.min(allGuests.length, Math.max(0, pickupCapacity - slotCount - 1))
            : allGuests.length
          confirmedPickup.push({ userId: reg.user_id, displayName: reg.display_name ?? reg.user_id, guestCount: confirmedGuestCount, guests: allGuests.slice(0, confirmedGuestCount) })
          slotCount += 1 + confirmedGuestCount
        }

        // ── 季打報名（排除請假）────────────────────────────────────
        const { data: seasonRegs, error: sErr } = await supabase
          .from('registrations')
          .select('user_id, display_name, guests, leave_dates')
          .eq('activity_id', activity.id).is('activity_date', null).eq('status', 'active')
          .order('created_at', { ascending: true })
        if (sErr) throw sErr

        const confirmedSeason: ConfirmedUser[] = (seasonRegs ?? [])
          .filter(r => !(r.leave_dates || []).includes(targetDate))
          .map(r => {
            const allGuests = (r.guests as Array<{ gender?: string }>) ?? []
            return { userId: r.user_id, displayName: r.display_name ?? r.user_id, guestCount: allGuests.length, guests: allGuests }
          })

        if (confirmedPickup.length === 0 && confirmedSeason.length === 0) continue

        // ── 性別計數 ──────────────────────────────────────────────
        const allUserIds = [...confirmedPickup, ...confirmedSeason].map(u => u.userId)
        const genderMap: Record<string, string | null> = {}
        if (allUserIds.length) {
          const { data: memberData } = await supabase.from('members').select('user_id, gender').in('user_id', [...new Set(allUserIds)])
          if (memberData) memberData.forEach(m => { genderMap[m.user_id] = m.gender || null })
        }
        let maleCount = 0, femaleCount = 0
        const countUser = (u: ConfirmedUser) => {
          const g = genderMap[u.userId]
          if (g === 'male') maleCount++; else if (g === 'female') femaleCount++
          for (const guest of u.guests) {
            if (guest.gender === 'male') maleCount++; else if (guest.gender === 'female') femaleCount++
          }
        }
        confirmedPickup.forEach(countUser)
        confirmedSeason.forEach(countUser)

        // ── 組訊息 ────────────────────────────────────────────────
        const activityLabel = activity.pickup_label ?? activity.title
        const substitution: Record<string, unknown> = {}
        const fallbackNames: Record<string, string> = {}
        let mentionIdx = 0

        const buildMentionLine = (users: ConfirmedUser[]): string => {
          const parts: string[] = []
          for (const u of users) {
            const key = `m${mentionIdx++}`
            substitution[key] = { type: 'mention', mentionee: { type: 'user', userId: u.userId } }
            fallbackNames[key] = u.displayName
            const suffix = u.guestCount > 0 ? `（含群外+${u.guestCount}）` : ''
            parts.push(`{${key}}${suffix}`)
          }
          return parts.join(' ')
        }

        const pickupLine = confirmedPickup.length > 0 ? buildMentionLine(confirmedPickup) : null
        const seasonLine = confirmedSeason.length > 0 ? buildMentionLine(confirmedSeason) : null

        const genderLine = (maleCount > 0 || femaleCount > 0)
          ? `男生：${maleCount}男 ／ 女生：${femaleCount}女\n` : ''

        const orgParts: string[] = []
        for (const org of organizers ?? []) {
          const key = `org${mentionIdx++}`
          substitution[key] = { type: 'mention', mentionee: { type: 'user', userId: org.user_id } }
          fallbackNames[key] = org.display_name ?? org.user_id
          orgParts.push(`{${key}}`)
        }
        const baseFee = activity.pickup_fee_per_session ?? 0
        const fee = baseFee + (activity.ac_enabled ? (activity.ac_fee ?? 0) : 0) || null
        const feeStr = fee ? ` $${fee}💰` : ''
        const footer = `請儘量提早5～10分鐘進場熱身\n臨打費用請轉給 ${orgParts.join('、') || '管理員'}${feeStr}`

        const header = `🏐 活動前 ${activity.reminder_days_before} 天提醒！\n\n【${activityLabel}】\n📅 ${targetDate} ${activity.start_time ?? ''}\n📍 ${activity.location ?? ''}\n\n`
        const messageText = (
          header +
          (pickupLine ? `本週臨打\n${pickupLine}\n\n` : '') +
          (seasonLine ? `本週季打\n${seasonLine}\n\n` : '') +
          genderLine + footer
        ).trimEnd()

        await sendWithGranularFallback(lineToken, lineGroupId, messageText, substitution, fallbackNames)
        console.log(`Reminded: activity ${activity.id} (${targetDate}), pickup: ${confirmedPickup.length}, season: ${confirmedSeason.length}`)
        notified++
      }
    }

    return new Response(JSON.stringify({ notified }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('notify-activity-reminder error', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : JSON.stringify(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
