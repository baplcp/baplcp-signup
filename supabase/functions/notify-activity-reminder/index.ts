import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchRegistrationGuests, fetchSeasonRegistrationDateStatuses } from '../_shared/normalized-collection-data.ts'
import { getTaiwanDateAndHour } from '../_shared/taiwan-date.ts'

async function pushMessage(token: string, groupId: string, message: Record<string, unknown>): Promise<void> {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: groupId, messages: [message] }),
  })
  if (!res.ok) throw new Error(`LINE push failed: ${await res.text()}`)
}

// 逐一找出不在群組的 key，換成純文字後重試，其餘人維持 @mention
async function sendWithGranularFallback(token: string, groupId: string, text: string, substitution: Record<string, unknown>, fallbackNames: Record<string, string>): Promise<void> {
  let currentText = text
  const sub = { ...substitution }
  const maxRetries = Object.keys(substitution).length + 1

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const message = Object.keys(sub).length > 0 ? { type: 'textV2', text: currentText, substitution: sub } : { type: 'text', text: currentText }
      await pushMessage(token, groupId, message)
      return
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('not found in the group') && !msg.includes('in the request body is invalid')) throw e

      // 嘗試從錯誤訊息找出哪個特定 key 失敗，例如 substitution["m3"].mentionee
      const match = msg.match(/substitution\[(?:\\?")?([^"\\[\]]+)/)
      if (!match) {
        // LINE 未指定哪個 key 失敗（"property":"substitution" 通用錯誤）
        // 將所有剩餘 mention 換成純文字後送出
        const remainingKeys = Object.keys(sub)
        if (remainingKeys.length === 0) throw e
        console.warn(`Substitution error without specific key, replacing all ${remainingKeys.length} mentions with plain text`)
        for (const k of remainingKeys) {
          const plainName = fallbackNames[k]
          if (plainName !== undefined) currentText = currentText.replace(`{${k}}`, plainName)
          delete sub[k]
        }
        continue
      }
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

type ConfirmedUser = { userId: string; displayName: string; guestCount: number; guests: Array<{ gender?: string }>; selfInPickup?: boolean }

function registrationMember(registration: { member?: { user_id?: string; display_name?: string } | Array<{ user_id?: string; display_name?: string }> }) {
  const member = Array.isArray(registration.member) ? registration.member[0] : registration.member
  if (!member?.user_id) throw new Error('registration_member_not_found')
  return member
}

serve(async _req => {
  try {
    const lineToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN_SUB')
    const lineGroupId = Deno.env.get('LINE_GROUP_ID_NOTIFY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!lineToken || !lineGroupId) return new Response('Missing LINE config', { status: 500 })

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { date: todayTw, hour: hourTw } = getTaiwanDateAndHour()

    const { data: activities, error: actErr } = await supabase.rpc('list_activity_reminder_notification_candidates', {
      p_today: todayTw,
      p_hour: hourTw,
    })
    if (actErr) throw actErr

    if (!activities?.length) return new Response(JSON.stringify({ notified: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } })

    const { data: organizers } = await supabase.from('members').select('user_id, display_name').eq('role', 'organizer')

    let notified = 0

    for (const activity of activities ?? []) {
      const targetActivityDates = [{ id: activity.activity_date_id, activity_date: activity.activity_date }]

      for (const targetActivityDate of targetActivityDates) {
        const targetDate = targetActivityDate.activity_date
        // ── 季打報名 ──────────────────────────────────────────────
        const { data: seasonRegs, error: sErr } = await supabase
          .from('registrations')
          .select('id, member_id, created_at, member:members!registrations_member_id_fkey(user_id, display_name)')
          .eq('activity_id', activity.id)
          .is('activity_date_id', null)
          .is('cancelled_at', null)
        if (sErr) throw sErr
        const seasonDateStatuses = await fetchSeasonRegistrationDateStatuses(
          supabase,
          (seasonRegs || []).map(registration => registration.id),
          targetActivityDate.id
        )

        // ── 臨打報名 ──────────────────────────────────────────────
        const { data: pickupRegs, error: pErr } = await supabase
          .from('registrations')
          .select('id, member_id, created_at, member:members!registrations_member_id_fkey(user_id, display_name)')
          .eq('activity_id', activity.id)
          .eq('activity_date_id', targetActivityDate.id)
          .is('cancelled_at', null)
        if (pErr) throw pErr
        const guests = await fetchRegistrationGuests(supabase, targetActivityDate.id)
        const memberIds = [
          ...new Set([...(seasonRegs || []).map(registration => registration.member_id), ...(pickupRegs || []).map(registration => registration.member_id), ...guests.map(guest => guest.invited_by)]),
        ]
        const { data: guestInviters, error: invitersError } = await supabase.from('members').select('id, user_id, display_name').in('id', memberIds)
        if (invitersError) throw invitersError
        const memberById = new Map((guestInviters || []).map(member => [member.id, member]))

        const totalCapacity = Number(activity.single_capacity) || 0

        // ── 統一排序與名額計算（對齊前端 useActivityMemberLists 邏輯）──
        // 與前端相同：season + pickup 全部展平後依時間排序，再依 single_capacity 截斷
        type FlatSlot = {
          kind: 'season_self' | 'pickup_self' | 'guest'
          userId: string
          displayName: string
          ts: string
          guestData?: { gender?: string; name?: string }
        }

        const mainSlots: FlatSlot[] = []

        for (const reg of seasonRegs ?? []) {
          const member = registrationMember(reg)
          const dateStatus = seasonDateStatuses.get(reg.id)
          if (dateStatus?.is_on_leave) continue
          // 同前端：有回歸時間則用回歸時間，否則用 created_at
          const ts = dateStatus?.rejoined_at || reg.created_at
          mainSlots.push({ kind: 'season_self', userId: member.user_id, displayName: member.display_name ?? member.user_id, ts })
        }

        for (const reg of pickupRegs ?? []) {
          const member = registrationMember(reg)
          mainSlots.push({ kind: 'pickup_self', userId: member.user_id, displayName: member.display_name ?? member.user_id, ts: reg.created_at })
        }

        for (const guest of guests) {
          const member = memberById.get(guest.invited_by)
          if (!member) continue
          mainSlots.push({
            kind: 'guest',
            userId: member.user_id,
            displayName: member.display_name ?? member.user_id,
            ts: guest.created_at,
            guestData: { gender: guest.gender ?? undefined, name: guest.display_name ?? undefined },
          })
        }

        mainSlots.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
        const confirmedSlots = totalCapacity > 0 ? mainSlots.slice(0, totalCapacity) : mainSlots

        // ── 重組 confirmedSeason / confirmedPickup ─────────────────
        const confirmedSeason: ConfirmedUser[] = []
        const pickupMap = new Map<string, { displayName: string; guests: Array<{ gender?: string }>; hasSelf: boolean }>()

        for (const slot of confirmedSlots) {
          if (slot.kind === 'season_self') {
            confirmedSeason.push({ userId: slot.userId, displayName: slot.displayName, guestCount: 0, guests: [], selfInPickup: true })
          } else if (slot.kind === 'pickup_self') {
            if (!pickupMap.has(slot.userId)) pickupMap.set(slot.userId, { displayName: slot.displayName, guests: [], hasSelf: false })
            pickupMap.get(slot.userId)!.hasSelf = true
          } else {
            if (!pickupMap.has(slot.userId)) pickupMap.set(slot.userId, { displayName: slot.displayName, guests: [], hasSelf: false })
            pickupMap.get(slot.userId)!.guests.push(slot.guestData as { gender?: string })
          }
        }

        const confirmedPickup: ConfirmedUser[] = []
        for (const [userId, { displayName, guests, hasSelf }] of pickupMap) {
          if (!hasSelf && guests.length === 0) continue
          confirmedPickup.push({ userId, displayName, guestCount: guests.length, guests, selfInPickup: hasSelf })
        }

        const remainingSlots = totalCapacity > 0 ? Math.max(0, totalCapacity - confirmedSlots.length) : 0

        if (confirmedPickup.length === 0 && confirmedSeason.length === 0) continue

        // ── 性別計數 ──────────────────────────────────────────────
        const allUserIds = [...confirmedPickup, ...confirmedSeason].map(u => u.userId)
        const genderMap: Record<string, string | null> = {}
        if (allUserIds.length) {
          const { data: memberData } = await supabase
            .from('members')
            .select('user_id, gender')
            .in('user_id', [...new Set(allUserIds)])
          if (memberData)
            memberData.forEach(m => {
              genderMap[m.user_id] = m.gender || null
            })
        }
        let maleCount = 0,
          femaleCount = 0
        const countUser = (u: ConfirmedUser) => {
          // selfInPickup === false 表示本人是季打請假只帶群外，不計本人性別
          if (u.selfInPickup !== false) {
            const g = genderMap[u.userId]
            if (g === 'male') maleCount++
            else if (g === 'female') femaleCount++
          }
          for (const guest of u.guests) {
            if (guest.gender === 'male') maleCount++
            else if (guest.gender === 'female') femaleCount++
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
            const suffix = u.guestCount > 0 ? (u.selfInPickup !== false ? `（含群外+${u.guestCount}）` : `（群外+${u.guestCount}）`) : ''
            parts.push(`{${key}}${suffix}`)
          }
          return parts.join(' ')
        }

        const pickupLine = confirmedPickup.length > 0 ? buildMentionLine(confirmedPickup) : null
        const seasonLine = confirmedSeason.length > 0 ? buildMentionLine(confirmedSeason) : null

        const genderLine = maleCount > 0 || femaleCount > 0 ? `男生：${maleCount}男 ／ 女生：${femaleCount}女\n\n` : ''

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

        const header = `🏐 活動前 ${activity.reminder_days_before} 天提醒！\n\n【${activityLabel}】\n📅 ${targetDate} ${activity.start_time?.slice(0, 5) ?? ''}\n📍 ${activity.location ?? ''}\n\n`
        const vacancyLine = remainingSlots > 0 ? `目前還缺 ${remainingSlots} 人，歡迎再報名！\n\n` : ''
        const messageText = (header + (pickupLine ? `本週臨打\n${pickupLine}\n\n` : '') + (seasonLine ? `本週季打\n${seasonLine}\n\n` : '') + genderLine + vacancyLine + footer).trimEnd()

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
