export async function sendSeasonLeaveNotification(token: string, groupId: string, displayName: string, activityTitle: string, activityDate: string): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text: `【季打請假提醒】\n${displayName} 已請假\n球局：${activityTitle}\n日期：${activityDate}` }],
    }),
  })
  if (!response.ok) throw new Error(`LINE push failed: ${await response.text()}`)
}
