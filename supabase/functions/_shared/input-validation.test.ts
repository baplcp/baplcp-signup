import { parseActivityPayload, parseSaveRegistrationInput, parseSeasonLeaveInput } from './input-validation.ts'

Deno.test('parseActivityPayload normalizes allowed fields and rejects oversized input', () => {
  const payload = parseActivityPayload({
    title: '  週日球局  ',
    location: '  體育館  ',
    dates: ['2026-10-04'],
    season_fee_per_session: '100',
    unknown: 'discarded',
  })

  if (payload.title !== '週日球局' || payload.location !== '體育館' || payload.season_fee_per_session !== 100) {
    throw new Error('expected valid activity payload to be normalized')
  }
  if ('unknown' in payload) throw new Error('expected unknown fields to be stripped')

  try {
    parseActivityPayload({ title: 'a'.repeat(121), location: '體育館', dates: ['2026-10-04'] })
    throw new Error('expected oversized title to be rejected')
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'invalid_text') throw error
  }
})

Deno.test('registration payloads enforce bounded guest arrays and normalized guests', () => {
  const registration = parseSaveRegistrationInput(
    {
      activityDate: '2026-10-04',
      selfCount: '1',
      guestCount: '1',
      guests: [{ name: '  小明  ', gender: 'male' }],
    },
    6
  )

  if (registration.selfCount !== 1 || registration.guests[0].name !== '小明') throw new Error('expected registration input to be normalized')

  try {
    parseSeasonLeaveInput({ activityDate: '2026-10-04', selfCount: 0, guestCount: 7, guests: [] }, 6)
    throw new Error('expected guest-count limit to be enforced')
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'invalid_guest_count') throw error
  }
})
