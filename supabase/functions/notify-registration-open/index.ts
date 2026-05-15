import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LIFF_ID = '2009808077-q6H0su3r'

// Taiwan is UTC+8, no DST — all time arithmetic uses fixed +8 offset
function getSeasonOpenAt(openDateStr: string, openTimeStr: string): Date {
  const [y, mo, d] = openDateStr.split('-').map(Number)
  const [h, m] = openTimeStr.split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h - 8, m, 0))
}

function getPickupOpenAt(activityDateStr: string, openDaysBefore: number, openTimeStr: string): Date {
  const [y, mo, d] = activityDateStr.split('-').map(Number)
  const [h, m] = openTimeStr.split(':').map(Number)
  return new Date(Date.UTC(y, mo - 1, d - openDaysBefore, h - 8, m, 0))
}

// 檢查時間是否落在「now+4min ~ now+5min」窗口內（避免每分鐘重複通知）
function isInNotifyWindow(dt: Date, now: Date): boolean {
  const windowStart = new Date(now.getTime() + 4 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 5 * 60 * 1000)
  return dt >= windowStart && dt < windowEnd
}

async function sendLineMessage(token: string, groupId: string, text: string): Promise<void> {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LINE push failed: ${err}`)
  }
}

serve(async (_req) => {
  try {
    const lineToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
    const lineGroupId = Deno.env.get('LINE_GROUP_ID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!lineToken || !lineGroupId) {
      console.error('Missing LINE env vars: LINE_CHANNEL_ACCESS_TOKEN or LINE_GROUP_ID')
      return new Response('Missing LINE config', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const now = new Date()

    const { data: activities, error } = await supabase
      .from('activities')
      .select(
        'id, title, location, start_time, dates, season_enabled, season_open_date, season_open_time, pickup_open_days_before, pickup_open_time'
      )

    if (error) throw error

    type Notification = {
      id: number
      title: string
      location: string
      startTime: string
      activityDate: string
      type: 'season' | 'pickup'
    }

    const notifications: Notification[] = []

    for (const activity of activities ?? []) {
      const dates: string[] = Array.isArray(activity.dates)
        ? activity.dates
        : typeof activity.dates === 'string'
          ? JSON.parse(activity.dates)
          : []

      // 季打報名通知
      if (activity.season_enabled && activity.season_open_date && activity.season_open_time) {
        const openAt = getSeasonOpenAt(activity.season_open_date, activity.season_open_time)
        if (isInNotifyWindow(openAt, now)) {
          notifications.push({
            id: activity.id,
            title: activity.title,
            location: activity.location ?? '',
            startTime: activity.start_time ?? '',
            activityDate: dates[0] ?? '',
            type: 'season',
          })
        }
      }

      // 臨打報名通知（每個場次日期獨立判斷）
      if (activity.pickup_open_days_before != null && activity.pickup_open_time) {
        for (const dateStr of dates) {
          const openAt = getPickupOpenAt(dateStr, activity.pickup_open_days_before, activity.pickup_open_time)
          if (isInNotifyWindow(openAt, now)) {
            notifications.push({
              id: activity.id,
              title: activity.title,
              location: activity.location ?? '',
              startTime: activity.start_time ?? '',
              activityDate: dateStr,
              type: 'pickup',
            })
          }
        }
      }
    }

    for (const n of notifications) {
      const liffState = encodeURIComponent(`#/active-activity?id=${n.id}&date=${n.activityDate}&type=${n.type}`)
      const registrationUrl = `https://liff.line.me/${LIFF_ID}?liff.state=${liffState}`
      const typeLabel = n.type === 'season' ? '季打' : '臨打'
      const text =
        `🏐 ${typeLabel}報名即將開始！（5 分鐘後）\n\n` +
        `【${n.title}】\n` +
        `📅 ${n.activityDate} ${n.startTime}\n` +
        `📍 ${n.location}\n\n` +
        `👉 立即報名：\n${registrationUrl}`

      await sendLineMessage(lineToken, lineGroupId, text)
      console.log(`Notified: activity ${n.id} (${n.type}, ${n.activityDate})`)
    }

    return new Response(JSON.stringify({ notified: notifications.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('notify-registration-open error', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
