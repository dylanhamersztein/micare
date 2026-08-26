import { describe, expect, it } from 'vitest'

import { describeRouteGuards, routeSource } from './support/route-source'

import type { GuardedRoute } from './support/route-source'

// The authenticated Practitioner routes Slice 34 brought onto the design
// system. The guards themselves live in tests/unit/support/route-source.ts,
// shared with the consumer and acquisition routes.

const PRACTITIONER_ROUTES: ReadonlyArray<GuardedRoute> = [
  {
    file: 'dashboard.tsx',
    markers: [
      'dashboard',
      'dashboard-sign-out',
      'dashboard-verification-status',
      'dashboard-subscription-status',
      'dashboard-clickthrough-count',
      'dashboard-last-verified-at',
      'dashboard-public-profile-link',
      'dashboard-billing-portal',
    ],
    hydrates: true,
  },
  {
    file: 'practitioner/profile-editor.tsx',
    markers: [
      'profile-editor-no-short-id',
      'profile-editor-unknown',
      'completeness-required-banner',
      'completeness-polish-banner',
      'profile-saved-visible',
      'profile-saved-hidden',
      'profile-postcode-not-found',
      'profile-server-error',
      'profile-editor',
      'profile-practice-name',
      'profile-practice-name-error',
      'profile-address-line1',
      'profile-address-line1-error',
      'profile-address-line2',
      'profile-address-line3',
      'profile-postcode',
      'profile-postcode-error',
      'profile-town',
      'profile-town-error',
      'profile-booking-link',
      'profile-booking-link-error',
      'profile-by-appointment',
      'profile-opening-hours',
      'profile-hours-error',
      'profile-bio',
      'profile-photo-uploader',
      'profile-photo-preview',
      'profile-photo-remove',
      'profile-photo-input',
      'profile-photo-uploading',
      'profile-photo-error',
      'profile-services',
      'profile-languages',
      'profile-accessibility-notes',
      'profile-accepting-new-patients',
      'profile-save',
    ],
    templatedMarkers: [
      {
        example: 'profile-hours-monday',
        template: 'data-testid={`profile-hours-${day.toLowerCase()}`}',
      },
    ],
    hydrates: true,
  },
]

describeRouteGuards(PRACTITIONER_ROUTES)

// The one number that justifies the £29, and the two states that are easy to
// get wrong. These are properties of the dashboard specifically, so they live
// here rather than in the shared guards.
describe('the dashboard', () => {
  /** The source of each `<StatusReadout>` on the page, in document order. */
  async function readouts(): Promise<Array<string>> {
    const source = await routeSource('dashboard.tsx')

    return source.split('<StatusReadout').slice(1)
  }

  it('gives the Click-through count the emphasis, and gives it to nothing else', async () => {
    const emphasised = (await readouts()).filter((tag) =>
      tag.includes('emphasis'),
    )

    expect(emphasised).toHaveLength(1)
    expect(emphasised[0]).toContain('dashboard-clickthrough-count')
  })

  it('reports the count against the Billing Cycle it was counted in', async () => {
    const [clickthroughs] = (await readouts()).filter((tag) =>
      tag.includes('dashboard-clickthrough-count'),
    )

    expect(clickthroughs).toContain('cycleStart')
  })

  it('states both statuses with the shared badges, not with bare label strings', async () => {
    const source = await routeSource('dashboard.tsx')

    expect(source).toContain('<VerificationBadge')
    expect(source).toContain('<SubscriptionBadge')
    expect(source).not.toContain('VERIFICATION_LABELS')
    expect(source).not.toContain('SUBSCRIPTION_LABELS')
  })
})

// The photo rules live in one place each. The editor may state them, but it
// may not restate them — a second copy is a copy that goes stale.
describe('the profile editor', () => {
  it('takes its photo guidance from the policy that enforces it', async () => {
    const source = await routeSource('practitioner/profile-editor.tsx')

    expect(source).toContain('PHOTO_CONSTRAINTS_HELP')
    expect(source).toContain('PHOTO_SUBJECT_HELP')
  })

  it('takes its field limits from the schema that enforces them', async () => {
    const source = await routeSource('practitioner/profile-editor.tsx')

    expect(source).toContain('PROFILE_FIELD_LIMITS')
  })

  // The five required fields report together, and zod is what reports them.
  // Left to itself the browser stops at the first empty `required` control —
  // or at the first malformed `type="url"` — shows its own bubble, and never
  // lets the submit handler run, so four of the five errors never appear.
  it('opts out of the browser’s parallel validator', async () => {
    const source = await routeSource('practitioner/profile-editor.tsx')

    expect(source).toContain('noValidate')
  })

  it('builds its fields from the Field primitive', async () => {
    const source = await routeSource('practitioner/profile-editor.tsx')

    expect(source).toContain('<Field')
    // The hand-rolled local `Field` this route carried is gone: the primitive
    // is imported, not redefined beside a form that already has one.
    expect(source).not.toMatch(/^function Field\(/m)
  })
})
