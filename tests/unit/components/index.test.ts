import { describe, expect, it } from 'vitest'

import * as components from '#/components'

// `src/components/` is the home for shared presentational components, reached
// through the existing `#/*` alias rather than a ladder of `../../`.
const PRIMITIVES = [
  'Alert',
  'Button',
  'Field',
  'SegmentedRadio',
  'Select',
  'TextInput',
  'Textarea',
  'VerificationBadge',
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
