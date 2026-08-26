export const MAX_BYTES = 5 * 1024 * 1024
export const MIN_DIMENSION = 400
export const MAX_DIMENSION = 4000

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as ReadonlyArray<string>).includes(value)
}

export function isWithinByteSize(byteLength: number): boolean {
  return byteLength > 0 && byteLength <= MAX_BYTES
}

export function isWithinDimensions(dim: {
  width: number
  height: number
}): boolean {
  return (
    dim.width >= MIN_DIMENSION &&
    dim.height >= MIN_DIMENSION &&
    dim.width <= MAX_DIMENSION &&
    dim.height <= MAX_DIMENSION
  )
}

/** The word a Practitioner calls each allowed format, keyed by its MIME type. */
const FORMAT_WORD: Readonly<Record<AllowedMimeType, string>> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
}

/** "A, B or C" — the list form English reads, not a comma-joined array. */
function inWords(items: ReadonlyArray<string>): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`
}

/**
 * The policy above, stated to the Practitioner uploading against it. Derived
 * rather than typed out beside the constants, so a limit cannot be raised in
 * code and left wrong on the screen.
 */
export const PHOTO_CONSTRAINTS_HELP =
  `${inWords(ALLOWED_MIME_TYPES.map((mime) => FORMAT_WORD[mime]))} · ` +
  `up to ${MAX_BYTES / 1024 / 1024} MB · ` +
  `between ${MIN_DIMENSION} and ${MAX_DIMENSION} pixels on each side`

/**
 * What the photo has to be of. The dimension and size rules are machine-
 * checkable; this one is the rule the face check enforces, said out loud
 * before it is enforced rather than only in the rejection message.
 */
export const PHOTO_SUBJECT_HELP =
  'One clear, front-facing photo of you — the Practitioner, facing the ' +
  'camera, on your own. Not your Practice, not a group, not a logo. ' +
  'Consumers use it to recognise you at the door.'
