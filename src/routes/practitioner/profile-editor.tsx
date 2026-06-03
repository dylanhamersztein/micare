import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import { profileCompleteness } from '../../profile-completeness'
import { profileEditorInputSchema } from '../../profile-editor-input'
import type { ProfileEditorInput } from '../../profile-editor-input'
import { loadProfile } from '../../server/profile-load'
import type { EditableProfile } from '../../server/profile-load-impl'
import { submitProfileUpdate } from '../../server/profile-update'

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const
type Day = (typeof DAYS)[number]

const searchSchema = z.object({
  short_id: z.string().trim().min(1).optional(),
})

export const Route = createFileRoute('/practitioner/profile-editor')({
  validateSearch: (raw) => searchSchema.parse(raw),
  loaderDeps: ({ search }) => ({ shortId: search.short_id }),
  loader: async ({ deps }) => {
    if (!deps.shortId) return { kind: 'no-short-id' as const }
    const profile = await loadProfile({ data: { shortId: deps.shortId } })
    if (!profile) return { kind: 'unknown' as const, shortId: deps.shortId }
    return { kind: 'ok' as const, profile }
  },
  component: ProfileEditorPage,
})

type FormState =
  | { kind: 'editing' }
  | { kind: 'submitting' }
  | { kind: 'saved'; visible: boolean }
  | { kind: 'invalid'; fieldErrors: Record<string, string> }
  | { kind: 'postcode-not-found' }
  | { kind: 'server-error'; message: string }

function ProfileEditorPage() {
  const loaderData = Route.useLoaderData()

  if (loaderData.kind === 'no-short-id') {
    return (
      <div
        className="mx-auto max-w-2xl p-8"
        data-testid="profile-editor-no-short-id"
      >
        <h1 className="text-2xl font-bold">We can&apos;t find your account</h1>
        <p className="mt-2 text-gray-700">
          Open the link from your payment confirmation email, or finish signup
          first so we can identify your profile.
        </p>
        <p className="mt-4">
          <Link to="/signup" className="underline">
            Start signup
          </Link>
        </p>
      </div>
    )
  }

  if (loaderData.kind === 'unknown') {
    return (
      <div
        className="mx-auto max-w-2xl p-8"
        data-testid="profile-editor-unknown"
      >
        <h1 className="text-2xl font-bold">We can&apos;t find your account</h1>
        <p className="mt-2 text-gray-700">
          The profile <code>{loaderData.shortId}</code> doesn&apos;t match any
          Practitioner on MiCare. Double-check the link.
        </p>
      </div>
    )
  }

  return <EditorForm profile={loaderData.profile} />
}

function emptyHours(): Record<Day, string> {
  return Object.fromEntries(DAYS.map((d) => [d, ''])) as Record<Day, string>
}

function hoursFromProfile(profile: EditableProfile): Record<Day, string> {
  const base = emptyHours()
  if (!profile.openingHours) return base
  for (const day of DAYS) {
    const value = profile.openingHours[day]
    if (typeof value === 'string') base[day] = value
  }
  return base
}

function EditorForm({ profile }: { profile: EditableProfile }) {
  const router = useRouter()

  const [practiceName, setPracticeName] = useState(profile.practiceName ?? '')
  const [addressLine1, setAddressLine1] = useState(
    profile.practiceAddressLine1 ?? '',
  )
  const [addressLine2, setAddressLine2] = useState(
    profile.practiceAddressLine2 ?? '',
  )
  const [addressLine3, setAddressLine3] = useState(
    profile.practiceAddressLine3 ?? '',
  )
  const [postcode, setPostcode] = useState(profile.practicePostcode ?? '')
  const [town, setTown] = useState(profile.practiceTown ?? '')
  const [bookingLinkUrl, setBookingLinkUrl] = useState(
    profile.bookingLinkUrl ?? '',
  )
  const [byAppointmentOnly, setByAppointmentOnly] = useState(
    profile.byAppointmentOnly,
  )
  const [hours, setHours] = useState<Record<Day, string>>(
    hoursFromProfile(profile),
  )
  const [bio, setBio] = useState(profile.bio ?? '')
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl ?? '')
  const [servicesText, setServicesText] = useState(profile.services.join(', '))
  const [languagesText, setLanguagesText] = useState(
    profile.languages.join(', '),
  )
  const [accessibilityNotes, setAccessibilityNotes] = useState(
    profile.accessibilityNotes ?? '',
  )
  const [acceptingNewPatients, setAcceptingNewPatients] = useState(
    profile.acceptingNewPatients,
  )
  const [state, setState] = useState<FormState>({ kind: 'editing' })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const services = useMemo(
    () =>
      servicesText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    [servicesText],
  )
  const languages = useMemo(
    () =>
      languagesText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    [languagesText],
  )

  const completeness = useMemo(
    () =>
      profileCompleteness({
        bio: bio.trim() || null,
        photoUrl: photoUrl.trim() || null,
        services,
        languages,
        accessibilityNotes: accessibilityNotes.trim() || null,
      }),
    [bio, photoUrl, services, languages, accessibilityNotes],
  )

  function collectInput():
    | ProfileEditorInput
    | { fieldErrors: Record<string, string> } {
    const trimmedHours: Record<string, string> = {}
    for (const day of DAYS) {
      const value = hours[day].trim()
      if (value.length > 0) trimmedHours[day] = value
    }
    const candidate = {
      practiceName,
      practiceAddressLine1: addressLine1,
      practiceAddressLine2: addressLine2.trim() ? addressLine2 : null,
      practiceAddressLine3: addressLine3.trim() ? addressLine3 : null,
      practicePostcode: postcode,
      practiceTown: town,
      bookingLinkUrl,
      openingHours: Object.keys(trimmedHours).length > 0 ? trimmedHours : null,
      byAppointmentOnly,
      bio: bio.trim() ? bio : null,
      photoUrl: photoUrl.trim() ? photoUrl : null,
      services,
      languages,
      accessibilityNotes: accessibilityNotes.trim() ? accessibilityNotes : null,
      acceptingNewPatients,
    }
    const parsed = profileEditorInputSchema.safeParse(candidate)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_form'
        if (!(key in fieldErrors)) fieldErrors[key] = issue.message
      }
      return { fieldErrors }
    }
    return parsed.data
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const collected = collectInput()
    if ('fieldErrors' in collected) {
      setState({ kind: 'invalid', fieldErrors: collected.fieldErrors })
      return
    }

    setState({ kind: 'submitting' })
    try {
      const result = await submitProfileUpdate({
        data: { shortId: profile.shortId, input: collected },
      })
      if (result.kind === 'saved') {
        setState({ kind: 'saved', visible: result.visible })
        await router.invalidate()
      } else if (result.kind === 'invalid') {
        setState({ kind: 'invalid', fieldErrors: result.fieldErrors })
      } else if (result.kind === 'postcode-not-found') {
        setState({ kind: 'postcode-not-found' })
      } else {
        setState({
          kind: 'server-error',
          message:
            'We could not find your account when saving. Please refresh and try again.',
        })
      }
    } catch (error) {
      setState({
        kind: 'server-error',
        message: error instanceof Error ? error.message : 'Save failed.',
      })
    }
  }

  function errorFor(key: string): string | undefined {
    return state.kind === 'invalid' ? state.fieldErrors[key] : undefined
  }

  const requiredFieldsComplete = Boolean(
    practiceName.trim() &&
    addressLine1.trim() &&
    postcode.trim() &&
    town.trim() &&
    bookingLinkUrl.trim(),
  )

  return (
    <div className="mx-auto max-w-2xl p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Your profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          Fill in the required fields to go live on MiCare. Polish fields are
          optional but help consumers choose you.
        </p>
      </header>

      {!requiredFieldsComplete && (
        <div
          className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm"
          data-testid="completeness-required-banner"
        >
          Required fields missing — your listing is hidden until you fill them
          in.
        </div>
      )}

      {requiredFieldsComplete && completeness.filled < completeness.total && (
        <div
          className="mb-4 rounded border border-blue-300 bg-blue-50 p-3 text-sm"
          data-testid="completeness-polish-banner"
        >
          {completeness.filled}/{completeness.total} polish fields filled.
          {completeness.missing.length > 0 && (
            <> Add a {completeness.missing[0]} to reach 100%.</>
          )}
        </div>
      )}

      {state.kind === 'saved' && state.visible && (
        <div
          className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm"
          data-testid="profile-saved-visible"
        >
          Saved — your profile is live on MiCare.
        </div>
      )}
      {state.kind === 'saved' && !state.visible && (
        <div
          className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm"
          data-testid="profile-saved-hidden"
        >
          Saved, but your profile is not yet live. Check your subscription
          status with the billing portal.
        </div>
      )}
      {state.kind === 'postcode-not-found' && (
        <div
          className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm"
          data-testid="profile-postcode-not-found"
        >
          We couldn&apos;t find that postcode. Please double-check it.
        </div>
      )}
      {state.kind === 'server-error' && (
        <div
          className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm"
          data-testid="profile-server-error"
        >
          {state.message}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
        data-testid="profile-editor"
        data-hydrated={hydrated ? 'true' : undefined}
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold uppercase text-gray-500">
            Required
          </legend>

          <Field
            label="Practice name"
            error={errorFor('practiceName')}
            testId="profile-practice-name"
            value={practiceName}
            onChange={setPracticeName}
          />
          <Field
            label="Address line 1"
            error={errorFor('practiceAddressLine1')}
            testId="profile-address-line1"
            value={addressLine1}
            onChange={setAddressLine1}
          />
          <Field
            label="Address line 2 (optional)"
            testId="profile-address-line2"
            value={addressLine2}
            onChange={setAddressLine2}
          />
          <Field
            label="Address line 3 (optional)"
            testId="profile-address-line3"
            value={addressLine3}
            onChange={setAddressLine3}
          />
          <Field
            label="Postcode"
            error={errorFor('practicePostcode')}
            testId="profile-postcode"
            value={postcode}
            onChange={setPostcode}
            placeholder="EC2V 6AA"
          />
          <Field
            label="Town"
            error={errorFor('practiceTown')}
            testId="profile-town"
            value={town}
            onChange={setTown}
          />
          <Field
            label="Booking link URL"
            error={errorFor('bookingLinkUrl')}
            testId="profile-booking-link"
            value={bookingLinkUrl}
            onChange={setBookingLinkUrl}
            placeholder="https://yourpractice.example/book"
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={byAppointmentOnly}
              onChange={(e) => setByAppointmentOnly(e.target.checked)}
              data-testid="profile-by-appointment"
            />
            By appointment only (hides opening hours)
          </label>

          {!byAppointmentOnly && (
            <div
              className="flex flex-col gap-2"
              data-testid="profile-opening-hours"
            >
              <span className="text-sm">Opening hours</span>
              {DAYS.map((day) => (
                <label
                  key={day}
                  className="grid grid-cols-[120px_1fr] items-center gap-2 text-sm"
                >
                  <span>{day}</span>
                  <input
                    type="text"
                    value={hours[day]}
                    onChange={(e) =>
                      setHours((h) => ({ ...h, [day]: e.target.value }))
                    }
                    placeholder="9:00-17:30 or Closed"
                    className="rounded border px-2 py-1"
                    data-testid={`profile-hours-${day.toLowerCase()}`}
                  />
                </label>
              ))}
            </div>
          )}

          {errorFor('byAppointmentOnly') && (
            <p
              className="text-sm text-red-600"
              data-testid="profile-hours-error"
            >
              {errorFor('byAppointmentOnly')}
            </p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold uppercase text-gray-500">
            Polish (optional)
          </legend>

          <label className="flex flex-col text-sm">
            Bio
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="mt-1 rounded border px-2 py-1"
              data-testid="profile-bio"
            />
          </label>
          <Field
            label="Photo URL (optional placeholder — upload ships later)"
            testId="profile-photo-url"
            value={photoUrl}
            onChange={setPhotoUrl}
          />
          <Field
            label="Services (comma-separated)"
            testId="profile-services"
            value={servicesText}
            onChange={setServicesText}
            placeholder="Eye exam, Contact lens fitting"
          />
          <Field
            label="Languages (comma-separated)"
            testId="profile-languages"
            value={languagesText}
            onChange={setLanguagesText}
            placeholder="English, French"
          />
          <label className="flex flex-col text-sm">
            Accessibility notes
            <textarea
              value={accessibilityNotes}
              onChange={(e) => setAccessibilityNotes(e.target.value)}
              rows={2}
              className="mt-1 rounded border px-2 py-1"
              data-testid="profile-accessibility-notes"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acceptingNewPatients}
              onChange={(e) => setAcceptingNewPatients(e.target.checked)}
              data-testid="profile-accepting-new-patients"
            />
            Currently accepting new patients
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={state.kind === 'submitting'}
          className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          data-testid="profile-save"
        >
          {state.kind === 'submitting' ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  )
}

function Field({
  label,
  testId,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string
  testId: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  error?: string
}) {
  return (
    <label className="flex flex-col text-sm">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 rounded border px-2 py-1"
        data-testid={testId}
      />
      {error && (
        <span
          className="mt-1 text-xs text-red-600"
          data-testid={`${testId}-error`}
        >
          {error}
        </span>
      )}
    </label>
  )
}
