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
