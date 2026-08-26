import { describe, expect, it } from 'vitest'

import * as components from '#/components'

// `src/components/` is the home for shared presentational components, reached
// through the existing `#/*` alias rather than a ladder of `../../`.
const PRIMITIVES = [
  'Alert',
  'Button',
  'Field',
  'NoticePage',
  'PractitionerResultCard',
  'SegmentedRadio',
  'SignupOutcome',
  'Select',
  'TextInput',
  'Textarea',
  'VerificationBadge',
  'VerificationWait',
]

describe('the components barrel', () => {
  for (const primitive of PRIMITIVES) {
    it(`exports ${primitive}`, () => {
      expect(typeof (components as Record<string, unknown>)[primitive]).toBe(
        'function',
      )
    })
  }
})
