import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function formatTime(time: string | null): string {
  return time?.slice(0, 5) ?? ''
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
    const windowStart = new Date(now.getTime() + 4 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 5 * 60 * 1000)
    const { data, error } = await supabase.rpc('list_registration_open_notification_candidates', {
      p_window_start: windowStart.toISOString(),
      p_window_end: windowEnd.toISOString(),
    })
    if (error) throw error

    const notifications: Notification[] = (data || []).map(notification => ({
      id: notification.activity_id,
      title: notification.title,
      pickupLabel: notification.pickup_label ?? null,
      location: notification.location ?? '',
      startTime: formatTime(notification.start_time),
      endTime: formatTime(notification.end_time),
      activityDate: notification.activity_date ?? '',
      type: notification.notification_type === 'season' ? 'season' : 'pickup',
    }))

    for (const n of notifications) {
      const registrationQuery = new URLSearchParams({
        date: n.activityDate,
        type: n.type,
      })
      const registrationUrl = `https://liff.line.me/${liffId}#/activities/${n.id}?${registrationQuery}`
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
