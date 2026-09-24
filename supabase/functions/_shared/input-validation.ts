import { z } from 'npm:zod@4.6.5'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^(\d{2}):(\d{2})$/

const MAX_ACTIVITY_DATES = 366
const MAX_ACTIVITY_TITLE_LENGTH = 120
const MAX_ACTIVITY_LOCATION_LENGTH = 200
const MAX_PICKUP_LABEL_LENGTH = 80
const MAX_GUEST_NAME_LENGTH = 40

function parseInput<T extends z.ZodType>(schema: T, input: unknown, fallbackError: string): z.output<T> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  throw new Error(result.error.issues[0]?.message || fallbackError)
}

function finiteNumberOrFallback(value: unknown, fallback: number) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function integerWithFallback(fallback: number, min: number, max: number) {
  return z.preprocess(value => finiteNumberOrFallback(value, fallback), z.number({ error: 'invalid_number' }).int('invalid_number').min(min, 'invalid_number').max(max, 'invalid_number'))
}

function nullableInteger(min: number, max: number) {
  return z.preprocess(
    value => (value == null || value === '' ? null : Number(value)),
    z.number({ error: 'invalid_number' }).int('invalid_number').min(min, 'invalid_number').max(max, 'invalid_number').nullable()
  )
}

function booleanWithFallback(fallback = false) {
  return z.preprocess(value => (value == null || value === '' ? fallback : value), z.boolean({ error: 'invalid_boolean' }))
}

function enumWithFallback<T extends readonly [string, ...string[]]>(values: T, fallback: T[number], errorName: string) {
  return z.preprocess(value => String(value || fallback), z.enum(values, { error: errorName }))
}

function requiredText(maxLength: number, missingError: string) {
  return z.preprocess(value => (typeof value === 'string' ? value.trim() : ''), z.string().min(1, missingError).max(maxLength, 'invalid_text'))
}

export const dateStringSchema = z.string({ error: 'invalid_date' }).regex(DATE_PATTERN, 'invalid_date')

export const timeStringSchema = z
  .string({ error: 'invalid_time' })
  .regex(TIME_PATTERN, 'invalid_time')
  .refine(value => {
    const [hour, minute] = value.split(':').map(Number)
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
  }, 'invalid_time')

const nullableDateSchema = z.preprocess(value => (value == null || value === '' ? null : value), dateStringSchema.nullable())
const nullableTimeSchema = z.preprocess(value => (value == null || value === '' ? null : value), timeStringSchema.nullable())

const activityPayloadSchema = z.object(
  {
    game_type: enumWithFallback(['season'], 'season', 'invalid_game_type'),
    title: requiredText(MAX_ACTIVITY_TITLE_LENGTH, 'missing_title'),
    location: requiredText(MAX_ACTIVITY_LOCATION_LENGTH, 'missing_location'),
    dates: z.array(dateStringSchema, { error: 'invalid_dates' }).min(1, 'invalid_dates').max(MAX_ACTIVITY_DATES, 'invalid_dates'),
    start_time: nullableTimeSchema,
    end_time: nullableTimeSchema,
    season_fee_per_session: integerWithFallback(0, 0, 100000),
    season_half_year_fee_per_session: integerWithFallback(0, 0, 100000),
    pickup_fee_per_session: integerWithFallback(0, 0, 100000),
    ac_fee: integerWithFallback(0, 0, 100000),
    single_capacity: integerWithFallback(18, 1, 100),
    season_enabled: booleanWithFallback(),
    season_include_ac: booleanWithFallback(),
    season_capacity: z
      .preprocess(
        value => {
          if (value == null || value === '') return 'unlimited'
          if (value === 'unlimited') return value
          return finiteNumberOrFallback(value, 18)
        },
        z.union([z.literal('unlimited'), z.number({ error: 'invalid_number' }).int('invalid_number').min(1, 'invalid_number').max(18, 'invalid_number')])
      )
      .transform(String),
    season_open_date: nullableDateSchema,
    season_open_time: nullableTimeSchema,
    season_deadline_type: enumWithFallback(['unlimited', 'custom'], 'unlimited', 'invalid_deadline_type'),
    season_close_date: nullableDateSchema,
    season_close_time: nullableTimeSchema,
    season_late_enabled: booleanWithFallback(),
    season_late_open_date: nullableDateSchema,
    season_late_open_time: nullableTimeSchema,
    season_late_deadline_type: enumWithFallback(['unlimited', 'custom'], 'unlimited', 'invalid_deadline_type'),
    season_late_close_date: nullableDateSchema,
    season_late_close_time: nullableTimeSchema,
    pickup_label: z.preprocess(
      value => {
        if (value == null || value === '') return null
        return typeof value === 'string' ? value.trim() || null : value
      },
      z.string({ error: 'invalid_pickup_label' }).max(MAX_PICKUP_LABEL_LENGTH, 'invalid_pickup_label').nullable()
    ),
    pickup_open_days_before: nullableInteger(1, 7),
    pickup_open_time: nullableTimeSchema,
    pickup_deadline_type: enumWithFallback(['unlimited', 'custom'], 'unlimited', 'invalid_deadline_type'),
    pickup_close_days_before: nullableInteger(1, 7),
    pickup_close_time: nullableTimeSchema,
    reminder_enabled: booleanWithFallback(),
    reminder_days_before: nullableInteger(1, 7),
    reminder_time: nullableTimeSchema,
  },
  { error: 'invalid_payload' }
)

export type ActivityPayload = z.output<typeof activityPayloadSchema>

export function parseActivityPayload(input: unknown): ActivityPayload {
  return parseInput(activityPayloadSchema, input, 'invalid_payload')
}

function registrationDateSchema(errorName: string) {
  return z.string({ error: errorName }).regex(DATE_PATTERN, errorName)
}

function registrationCountSchema(errorName: string, maxCount: number) {
  return z.preprocess(value => Number(value ?? 0), z.number({ error: errorName }).int(errorName).min(0, errorName).max(maxCount, errorName))
}

function registrationInputSchema<TActivityDate extends z.ZodType>({ activityDate, maxGuests }: { activityDate: TActivityDate; maxGuests: number }) {
  const guestSchema = z.object(
    {
      id: z.string().uuid('invalid_guest_id').optional(),
      name: z.preprocess(value => (value == null ? '' : value), z.string({ error: 'invalid_guest_name' }).trim().max(MAX_GUEST_NAME_LENGTH, 'invalid_guest_name')),
      gender: z.enum(['male', 'female'], { error: 'invalid_guest_gender' }),
    },
    { error: 'invalid_guests' }
  )

  return z
    .object(
      {
        activityDate,
        selfCount: registrationCountSchema('invalid_self_count', 1),
        guestCount: registrationCountSchema('invalid_guest_count', maxGuests),
        guests: z.array(guestSchema, { error: 'invalid_guests' }).max(maxGuests, 'invalid_guest_count'),
      },
      { error: 'invalid_payload' }
    )
    .superRefine((value, context) => {
      if (value.guests.length < value.guestCount) {
        context.addIssue({ code: 'custom', message: 'guest_count_mismatch', path: ['guests'] })
      }
    })
}

export type RegistrationInput = {
  activityDate: string | null
  selfCount: number
  guestCount: number
  guests: Array<{ id?: string; name: string; gender: 'male' | 'female' }>
}

export function parseSaveRegistrationInput(input: unknown, maxGuests: number): RegistrationInput {
  return parseInput(registrationInputSchema({ activityDate: z.union([registrationDateSchema('invalid_activity_date'), z.null()]), maxGuests }), input, 'invalid_payload')
}

export function parseSeasonLeaveInput(input: unknown, maxGuests: number): RegistrationInput {
  return parseInput(registrationInputSchema({ activityDate: registrationDateSchema('invalid_activity_date'), maxGuests }), input, 'invalid_payload')
}
