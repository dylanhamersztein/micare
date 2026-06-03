export const PHOTO_CHECK_OUTCOMES = [
  'ok',
  'unsupported-type',
  'too-large',
  'too-small',
  'no-face',
  'multi-face',
] as const

export type PhotoCheckOutcome = (typeof PHOTO_CHECK_OUTCOMES)[number]

export function photoCheckMessage(
  outcome: Exclude<PhotoCheckOutcome, 'ok'>,
): string {
  switch (outcome) {
    case 'unsupported-type':
      return 'Upload a JPEG, PNG, or WebP image.'
    case 'too-large':
      return 'That photo is over 5 MB. Please upload a smaller file.'
    case 'too-small':
      return 'That photo is too small — please upload one at least 400×400 pixels (larger is better).'
    case 'no-face':
      return 'No face detected in that photo. Please upload a clear, front-facing headshot.'
    case 'multi-face':
      return 'We detected more than one face. Please upload a photo with only one face — yours.'
  }
}
