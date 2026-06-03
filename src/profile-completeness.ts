// Pure scorer for the optional polish fields that drive the completeness
// banner (AC #6). The required-field check lives in src/visibility.ts
// (`hasMinFields`) — once those are filled the banner disappears entirely;
// this module only reports the polish ratio shown while the banner is up.

export type CompletenessInput = {
  bio: string | null
  photoUrl: string | null
  services: ReadonlyArray<string>
  languages: ReadonlyArray<string>
  accessibilityNotes: string | null
}

const POLISH_FIELDS = [
  'bio',
  'photoUrl',
  'services',
  'languages',
  'accessibilityNotes',
] as const

export type CompletenessField = (typeof POLISH_FIELDS)[number]

export type CompletenessResult = {
  filled: number
  total: number
  missing: ReadonlyArray<CompletenessField>
}

function isFilled(field: CompletenessField, input: CompletenessInput): boolean {
  const value = input[field]
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'string' && value.trim().length > 0
}

export function profileCompleteness(
  input: CompletenessInput,
): CompletenessResult {
  const missing = POLISH_FIELDS.filter((field) => !isFilled(field, input))
  return {
    filled: POLISH_FIELDS.length - missing.length,
    total: POLISH_FIELDS.length,
    missing,
  }
}
