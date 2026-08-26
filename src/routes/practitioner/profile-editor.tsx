import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import {
  Alert,
  Button,
  Checkbox,
  Field,
  FileUpload,
  NoticePage,
  STANDALONE_LINK_CLASSES,
  TextInput,
  Textarea,
} from '#/components'
import {
  ALLOWED_MIME_TYPES,
  MAX_BYTES,
  PHOTO_CONSTRAINTS_HELP,
  PHOTO_SUBJECT_HELP,
  isAllowedMimeType,
} from '../../photo-policy'
import { photoCheckMessage } from '../../photo-check-result'
import type { PhotoCheckOutcome } from '../../photo-check-result'
import { profileCompleteness } from '../../profile-completeness'
import {
  PROFILE_FIELD_LIMITS,
  profileEditorInputSchema,
} from '../../profile-editor-input'
import type { ProfileEditorInput } from '../../profile-editor-input'
import { submitProfilePhoto } from '../../server/photo-upload'
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

/** 1,000 rather than 1000: a limit is a number a person has to hold in mind. */
const LIMIT_FORMAT = new Intl.NumberFormat('en-GB')

/** The limit the schema enforces, said in the words the field's help uses. */
function upTo(limit: number): string {
  return `Up to ${LIMIT_FORMAT.format(limit)} characters.`
}

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

type PhotoUploadState =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'failed'; outcome: Exclude<PhotoCheckOutcome, 'ok'> }

function ProfileEditorPage() {
  const loaderData = Route.useLoaderData()

  if (loaderData.kind === 'no-short-id') {
    return (
      <NoticePage
        tone="problem"
        eyebrow="We can’t identify you"
        title="We can’t find your account"
        data-testid="profile-editor-no-short-id"
      >
        <p>
          Open the link from your payment confirmation email, or finish signup
          first so we can identify your profile.
        </p>
        <p>
          <Link to="/signup" className={STANDALONE_LINK_CLASSES}>
            Start signup
          </Link>
        </p>
      </NoticePage>
    )
  }

  if (loaderData.kind === 'unknown') {
    return (
      <NoticePage
        tone="problem"
        eyebrow="We can’t identify you"
        title="We can’t find your account"
        data-testid="profile-editor-unknown"
      >
        <p>
          The profile{' '}
          <code className="rounded-xs bg-surface-sunk px-1.5 py-0.5 font-mono text-meta">
            {loaderData.shortId}
          </code>{' '}
          doesn’t match any Practitioner on MiCare. Double-check the link.
        </p>
      </NoticePage>
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
  const [photoUploadState, setPhotoUploadState] = useState<PhotoUploadState>({
    kind: 'idle',
  })
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

  async function onPhotoChosen(file: File) {
    // Some browsers (Linux/WSL without xdg-mime) report file.type as an
    // empty string for valid JPEGs. Only reject up front when the browser
    // confidently reports a disallowed MIME; otherwise let the server
    // sniff the bytes.
    if (file.type && !isAllowedMimeType(file.type)) {
      setPhotoUploadState({ kind: 'failed', outcome: 'unsupported-type' })
      return
    }
    if (file.size > MAX_BYTES) {
      setPhotoUploadState({ kind: 'failed', outcome: 'too-large' })
      return
    }

    setPhotoUploadState({ kind: 'uploading' })
    try {
      const fileBase64 = await fileToBase64(file)
      const result = await submitProfilePhoto({
        data: {
          shortId: profile.shortId,
          fileBase64,
          filename: file.name,
        },
      })
      if (result.kind === 'ok') {
        setPhotoUrl(result.photoUrl)
        setPhotoUploadState({ kind: 'idle' })
      } else if (result.kind === 'unknown') {
        setPhotoUploadState({
          kind: 'failed',
          outcome: 'unsupported-type',
        })
      } else {
        setPhotoUploadState({ kind: 'failed', outcome: result.kind })
      }
    } catch {
      setPhotoUploadState({ kind: 'failed', outcome: 'unsupported-type' })
    }
  }

  function onRemovePhoto() {
    setPhotoUrl('')
    setPhotoUploadState({ kind: 'idle' })
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
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <header>
        <h1 className="font-serif text-h1 font-medium tracking-tightest text-balance">
          Your profile
        </h1>
        <p className="mt-2 max-w-[56ch] text-text-body">
          Fill in the required fields to go live on MiCare. The polish fields
          are optional, but they are what a consumer reads when choosing between
          two verified Practitioners.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3">
        {!requiredFieldsComplete && (
          <div data-testid="completeness-required-banner">
            <Alert tone="warning" title="Required fields are still missing">
              Your listing stays hidden from consumers until they are filled in.
            </Alert>
          </div>
        )}

        {requiredFieldsComplete && completeness.filled < completeness.total && (
          <div data-testid="completeness-polish-banner">
            <Alert
              tone="info"
              title={`${completeness.filled} of ${completeness.total} polish fields filled`}
            >
              {completeness.missing.length > 0
                ? `Add a ${completeness.missing[0]} to reach 100%.`
                : 'Your listing is as complete as it gets.'}
            </Alert>
          </div>
        )}

        {state.kind === 'saved' && state.visible && (
          <div data-testid="profile-saved-visible">
            <Alert
              tone="success"
              title="Saved — your profile is live on MiCare"
            >
              Consumers searching near your postcode can find you now.
            </Alert>
          </div>
        )}
        {state.kind === 'saved' && !state.visible && (
          <div data-testid="profile-saved-hidden">
            <Alert
              tone="warning"
              title="Saved, but your profile is not live yet"
            >
              Check your subscription status on your dashboard, and use the
              billing portal if a payment needs attention.
            </Alert>
          </div>
        )}
        {state.kind === 'postcode-not-found' && (
          <div data-testid="profile-postcode-not-found">
            <Alert tone="error" title="We couldn’t find that postcode">
              Nothing was saved. Please double-check it and try again.
            </Alert>
          </div>
        )}
        {state.kind === 'server-error' && (
          <div data-testid="profile-server-error">
            <Alert tone="error" title="We couldn’t save your profile">
              {state.message}
            </Alert>
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        // zod reports every field at once and the page shows every one of
        // them. The browser's own validator would stop at the first empty
        // required control, show its bubble, and never let this handler run.
        noValidate
        className="mt-7 flex flex-col gap-7 rounded-md border border-border bg-surface-raised p-5 sm:p-6"
        data-testid="profile-editor"
        data-hydrated={hydrated ? 'true' : undefined}
      >
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-4 p-0 text-label font-bold tracking-caps text-text-muted uppercase">
            Required
          </legend>

          <div className="flex flex-col gap-5">
            <Field
              label="Practice name"
              requirement="required"
              help={`As it appears above your door. ${upTo(PROFILE_FIELD_LIMITS.practiceName)}`}
              error={
                errorFor('practiceName') && (
                  <span data-testid="profile-practice-name-error">
                    {errorFor('practiceName')}
                  </span>
                )
              }
            >
              <TextInput
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
                data-testid="profile-practice-name"
              />
            </Field>

            <Field
              label="Address line 1"
              requirement="required"
              help={upTo(PROFILE_FIELD_LIMITS.practiceAddressLine1)}
              error={
                errorFor('practiceAddressLine1') && (
                  <span data-testid="profile-address-line1-error">
                    {errorFor('practiceAddressLine1')}
                  </span>
                )
              }
            >
              <TextInput
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                data-testid="profile-address-line1"
              />
            </Field>

            <Field
              label="Address line 2"
              requirement="optional"
              help={upTo(PROFILE_FIELD_LIMITS.practiceAddressLine2)}
            >
              <TextInput
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                data-testid="profile-address-line2"
              />
            </Field>

            <Field
              label="Address line 3"
              requirement="optional"
              help={upTo(PROFILE_FIELD_LIMITS.practiceAddressLine3)}
            >
              <TextInput
                value={addressLine3}
                onChange={(e) => setAddressLine3(e.target.value)}
                data-testid="profile-address-line3"
              />
            </Field>

            <Field
              label="Postcode"
              requirement="required"
              help="The postcode consumers search against, so it has to be the Practice’s own."
              error={
                errorFor('practicePostcode') && (
                  <span data-testid="profile-postcode-error">
                    {errorFor('practicePostcode')}
                  </span>
                )
              }
            >
              <TextInput
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="EC2V 6AA"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                data-testid="profile-postcode"
              />
            </Field>

            <Field
              label="Town"
              requirement="required"
              help={upTo(PROFILE_FIELD_LIMITS.practiceTown)}
              error={
                errorFor('practiceTown') && (
                  <span data-testid="profile-town-error">
                    {errorFor('practiceTown')}
                  </span>
                )
              }
            >
              <TextInput
                value={town}
                onChange={(e) => setTown(e.target.value)}
                data-testid="profile-town"
              />
            </Field>

            <Field
              label="Booking link"
              requirement="required"
              help="Where “Book an appointment” sends a consumer. Must start with http:// or https://."
              error={
                errorFor('bookingLinkUrl') && (
                  <span data-testid="profile-booking-link-error">
                    {errorFor('bookingLinkUrl')}
                  </span>
                )
              }
            >
              <TextInput
                type="url"
                value={bookingLinkUrl}
                onChange={(e) => setBookingLinkUrl(e.target.value)}
                placeholder="https://yourpractice.example/book"
                data-testid="profile-booking-link"
              />
            </Field>

            <Checkbox
              label="By appointment only"
              help="Hides opening hours on your listing. Use it instead of hours, not as well as."
              checked={byAppointmentOnly}
              onChange={(e) => setByAppointmentOnly(e.target.checked)}
              data-testid="profile-by-appointment"
            />

            {!byAppointmentOnly && (
              <fieldset
                className="m-0 border-0 p-0"
                data-testid="profile-opening-hours"
              >
                <legend className="p-0 text-label font-bold tracking-caps text-text-body uppercase">
                  Opening hours
                </legend>
                <p className="mt-1.5 mb-4 text-meta text-text-muted">
                  One line a day, written as you would write it on the door —
                  “9:00-17:30”, or “Closed”.
                </p>
                <div className="flex flex-col gap-4">
                  {DAYS.map((day) => (
                    <Field key={day} label={day}>
                      <TextInput
                        value={hours[day]}
                        onChange={(e) =>
                          setHours((h) => ({ ...h, [day]: e.target.value }))
                        }
                        placeholder="9:00-17:30 or Closed"
                        data-testid={`profile-hours-${day.toLowerCase()}`}
                      />
                    </Field>
                  ))}
                </div>
              </fieldset>
            )}

            {errorFor('byAppointmentOnly') && (
              <div data-testid="profile-hours-error">
                <Alert tone="error" title={errorFor('byAppointmentOnly')} />
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-4 p-0 text-label font-bold tracking-caps text-text-muted uppercase">
            Polish
          </legend>

          <div className="flex flex-col gap-5">
            <Field
              label="Bio"
              requirement="optional"
              help={`A plain description of your Practice and what you do. ${bio.trim().length} of ${LIMIT_FORMAT.format(PROFILE_FIELD_LIMITS.bio)} characters used.`}
            >
              <Textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                data-testid="profile-bio"
              />
            </Field>

            <div
              className="flex flex-col gap-4"
              data-testid="profile-photo-uploader"
            >
              {photoUrl && (
                <div className="flex items-center gap-4">
                  <img
                    src={photoUrl}
                    alt="Your current profile photo"
                    className="size-20 shrink-0 rounded-sm border border-border object-cover"
                    data-testid="profile-photo-preview"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRemovePhoto}
                    data-testid="profile-photo-remove"
                  >
                    Remove photo
                  </Button>
                </div>
              )}
              <FileUpload
                label="Profile photo"
                guidance={PHOTO_SUBJECT_HELP}
                help={PHOTO_CONSTRAINTS_HELP}
                choose={
                  photoUrl ? 'Choose a different photo' : 'Choose a photo'
                }
                accept={ALLOWED_MIME_TYPES.join(',')}
                onFile={onPhotoChosen}
                disabled={photoUploadState.kind === 'uploading'}
                data-testid="profile-photo-input"
              />
              {photoUploadState.kind === 'uploading' && (
                <p
                  role="status"
                  className="text-meta text-text-muted"
                  data-testid="profile-photo-uploading"
                >
                  Checking your photo…
                </p>
              )}
              {photoUploadState.kind === 'failed' && (
                <div
                  data-testid="profile-photo-error"
                  data-outcome={photoUploadState.outcome}
                >
                  <Alert
                    tone="error"
                    title={photoCheckMessage(photoUploadState.outcome)}
                  >
                    Nothing was saved — your existing photo, if you have one, is
                    untouched.
                  </Alert>
                </div>
              )}
            </div>

            <Field
              label="Services"
              requirement="optional"
              help="Separate them with commas."
            >
              <TextInput
                value={servicesText}
                onChange={(e) => setServicesText(e.target.value)}
                placeholder="Eye exam, Contact lens fitting"
                data-testid="profile-services"
              />
            </Field>

            <Field
              label="Languages"
              requirement="optional"
              help="Separate them with commas."
            >
              <TextInput
                value={languagesText}
                onChange={(e) => setLanguagesText(e.target.value)}
                placeholder="English, French"
                data-testid="profile-languages"
              />
            </Field>

            <Field
              label="Accessibility notes"
              requirement="optional"
              help={`Step-free access, hearing loops, parking — what a consumer needs to know before they arrive. ${upTo(PROFILE_FIELD_LIMITS.accessibilityNotes)}`}
            >
              <Textarea
                rows={3}
                value={accessibilityNotes}
                onChange={(e) => setAccessibilityNotes(e.target.value)}
                data-testid="profile-accessibility-notes"
              />
            </Field>

            <Checkbox
              label="Currently accepting new patients"
              help="Shown on your listing. Turn it off when you are full."
              checked={acceptingNewPatients}
              onChange={(e) => setAcceptingNewPatients(e.target.checked)}
              data-testid="profile-accepting-new-patients"
            />
          </div>
        </fieldset>

        <Button
          type="submit"
          size="lg"
          className="self-start"
          loading={state.kind === 'submitting'}
          loadingLabel="Saving…"
          data-testid="profile-save"
        >
          Save profile
        </Button>
      </form>
    </main>
  )
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}
