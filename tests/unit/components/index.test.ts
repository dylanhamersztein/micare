import { describe, expect, it } from 'vitest'

import * as components from '#/components'

// `src/components/` is the home for shared presentational components, reached
// through the existing `#/*` alias rather than a ladder of `../../`.
const PRIMITIVES = [
  'Alert',
  'Button',
  'Checkbox',
  'Field',
  'FileUpload',
  'NoticePage',
  'PractitionerResultCard',
  'SegmentedRadio',
  'SignupOutcome',
  'SiteFooter',
  'SiteHeader',
  'StatusReadout',
  'SubscriptionBadge',
  'Select',
  'TextInput',
  'Textarea',
  'VerificationBadge',
  'VerificationWait',
  'Wordmark',
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
