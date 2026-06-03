import { describe, expect, it } from 'vitest'

import {
  PHOTO_CHECK_OUTCOMES,
  photoCheckMessage,
} from '../../src/photo-check-result'
import type { PhotoCheckOutcome } from '../../src/photo-check-result'

describe('PHOTO_CHECK_OUTCOMES', () => {
  it('enumerates every outcome the orchestrator can return', () => {
    expect(PHOTO_CHECK_OUTCOMES).toEqual([
      'ok',
      'unsupported-type',
      'too-large',
      'too-small',
      'no-face',
      'multi-face',
    ])
  })
})

describe('photoCheckMessage', () => {
  const cases: ReadonlyArray<{
    outcome: Exclude<PhotoCheckOutcome, 'ok'>
    contains: ReadonlyArray<string>
  }> = [
    { outcome: 'unsupported-type', contains: ['JPEG', 'PNG', 'WebP'] },
    { outcome: 'too-large', contains: ['5 MB', 'smaller'] },
    { outcome: 'too-small', contains: ['400', 'larger'] },
    { outcome: 'no-face', contains: ['no face', 'face'] },
    { outcome: 'multi-face', contains: ['only one', 'one face'] },
  ]

  for (const { outcome, contains } of cases) {
    it(`returns an actionable message for ${outcome}`, () => {
      const message = photoCheckMessage(outcome)
      for (const fragment of contains) {
        expect(message.toLowerCase()).toContain(fragment.toLowerCase())
      }
    })
  }

  it('every failure message is unique', () => {
    const failures = PHOTO_CHECK_OUTCOMES.filter(
      (o): o is Exclude<PhotoCheckOutcome, 'ok'> => o !== 'ok',
    )
    const messages = failures.map(photoCheckMessage)
    expect(new Set(messages).size).toBe(messages.length)
  })
})
