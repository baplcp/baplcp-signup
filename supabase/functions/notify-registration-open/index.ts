import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

async function sendLineMessage(token: string, groupId: string, message: Record<string, unknown>): Promise<void> {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [message],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LINE push failed: ${err}`)
  }
}

function buildRegistrationOpenFlexMessage(notification: Notification, registrationUrl: string): Record<string, unknown> {
  const typeLabel = notification.type === 'season' ? '季打' : '臨打'
  const notifyTitle = notification.type === 'pickup' && notification.pickupLabel ? notification.pickupLabel : notification.title
  const date = notification.activityDate || '未提供日期'
  const time = notification.startTime && notification.endTime ? `${notification.startTime}~${notification.endTime}` : '未提供時間'
  const location = notification.location || '未提供地點'

  return {
    type: 'flex',
    altText: notifyTitle,
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://baplcp.github.io/baplcp-signup/images/thumbnail.jpg',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
        action: {
          type: 'uri',
          uri: registrationUrl,
        },
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: `${typeLabel}報名將於 5 分鐘後開始`,
            weight: 'bold',
            color: '#5768ff',
            size: 'xs',
          },
          {
            type: 'text',
            text: notifyTitle,
            weight: 'bold',
            size: 'xl',
            wrap: true,
          },
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '📅日期', color: '#6b7280', size: 'sm', flex: 1 },
                  { type: 'text', text: date, color: '#111827', size: 'sm', wrap: true, flex: 4 },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '🕐時間', color: '#6b7280', size: 'sm', flex: 1 },
                  { type: 'text', text: time, color: '#111827', size: 'sm', wrap: true, flex: 4 },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '📍地點', color: '#6b7280', size: 'sm', flex: 1 },
                  { type: 'text', text: location, color: '#111827', size: 'sm', wrap: true, flex: 4 },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#5768ff',
            action: {
              type: 'uri',
              label: '立即前往',
              uri: registrationUrl,
            },
          },
        ],
      },
    },
  }
}

type Notification = {
  id: number
  title: string
  pickupLabel: string | null
  location: string
  startTime: string
  endTime: string
  activityDate: string
  type: 'season' | 'pickup'
}

serve(async _req => {
  try {
    const lineToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN_MAIN')
    const lineGroupId = Deno.env.get('LINE_GROUP_ID_MAIN')
    const liffId = Deno.env.get('LIFF_ID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!lineToken || !lineGroupId || !liffId) {
      console.error('Missing LINE env vars: LINE_CHANNEL_ACCESS_TOKEN_MAIN, LINE_GROUP_ID_MAIN, or LIFF_ID')
      return new Response('Missing LINE config', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const now = new Date()

    const { data: activities, error } = await supabase
      .from('activities')
      .select('id, title, pickup_label, location, start_time, end_time, dates, season_enabled, season_open_date, season_open_time, pickup_open_days_before, pickup_open_time')

    if (error) throw error

    const notifications: Notification[] = []

    for (const activity of activities ?? []) {
      const dates: string[] = Array.isArray(activity.dates) ? activity.dates : typeof activity.dates === 'string' ? JSON.parse(activity.dates) : []

      // 季打報名通知
      if (activity.season_enabled && activity.season_open_date && activity.season_open_time) {
        const openAt = getSeasonOpenAt(activity.season_open_date, activity.season_open_time)
        if (isInNotifyWindow(openAt, now)) {
          notifications.push({
            id: activity.id,
            title: activity.title,
            pickupLabel: activity.pickup_label ?? null,
            location: activity.location ?? '',
            startTime: activity.start_time ?? '',
            endTime: activity.end_time ?? '',
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
              pickupLabel: activity.pickup_label ?? null,
              location: activity.location ?? '',
              startTime: activity.start_time ?? '',
              endTime: activity.end_time ?? '',
              activityDate: dateStr,
              type: 'pickup',
            })
          }
        }
      }
    }

    for (const n of notifications) {
      const registrationQuery = new URLSearchParams({
        id: String(n.id),
        date: n.activityDate,
        type: n.type,
      })
      const registrationUrl = `https://liff.line.me/${liffId}#/active-activity?${registrationQuery}`
      const message = buildRegistrationOpenFlexMessage(n, registrationUrl)

      await sendLineMessage(lineToken, lineGroupId, message)
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
