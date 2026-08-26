import { Clock, CircleX, ShieldCheck, ShieldOff } from 'lucide-react'

import type { ComponentType } from 'react'
import type { VerificationStatus } from '../visibility'

// The badge behaves like an entry in a register: squared corners, a hairline
// rule, a hard left edge in the state colour, and — critically — it always
// cites its source and its date. A marketing sticker asserts; this one
// testifies.
//
// Two rules hold it together. Every state carries its own glyph and its own
// words, so nothing rides on colour alone. And the label restates only what
// the badge actually holds: with no check date it names the cadence instead,
// because a label must never cite a date the variant does not render.

const REGISTER = 'General Optical Council'

/** Day-first, the form a UK reader reads a record date in. */
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type StatusPlate = {
  /** The one word the inline badge shows. */
  word: string
  headline: (profession: string | undefined) => string
  /** The dated line on the plaque, or its dateless replacement. */
  record: (date: string | undefined) => string
  /** The closing sentence of the label. */
  cadence: (date: string | undefined) => string
  Glyph: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>
  /** The state at text weight on a white card — never the raw state hue. */
  ink: string
  /** Hairline and left edge, in the state's tone. */
  tone: string
  glyphTone: string
  inlineTone: string
}

const STATUS_PLATE: Readonly<Record<VerificationStatus, StatusPlate>> = {
  verified: {
    word: 'Verified',
    // Never a hardcoded word: the plaque names the Profession it verified.
    headline: (profession) =>
      profession === undefined ? 'Verified' : `Verified ${profession}`,
    record: (date) =>
      date === undefined
        ? 'Checked weekly · '
        : `Last checked ${date} · re-checked weekly`,
    cadence: (date) =>
      date === undefined
        ? 'Checked weekly against the register.'
        : `Checked ${date}.`,
    Glyph: ShieldCheck,
    ink: 'text-verified-ink',
    tone: 'border-verified-border border-l-verified',
    glyphTone: 'text-verified',
    inlineTone: 'border-verified-border bg-verified-bg',
  },
  pending: {
    word: 'Pending',
    headline: () => 'Verification pending',
    record: (date) =>
      date === undefined
        ? 'An operator will re-run this check'
        : `Could not reach the register on ${date} · an operator will re-run this check`,
    cadence: (date) =>
      date === undefined
        ? 'An operator will re-run this check.'
        : `Last attempted ${date}.`,
    Glyph: Clock,
    ink: 'text-pending-ink',
    tone: 'border-pending-border border-l-pending',
    glyphTone: 'text-pending',
    inlineTone: 'border-pending-border bg-pending-bg',
  },
  rejected: {
    word: 'Not found',
    headline: () => 'Not found on the register',
    record: (date) =>
      date === undefined
        ? 'No entry matches this number'
        : `No entry matched when we checked on ${date}`,
    cadence: (date) =>
      date === undefined ? 'No entry matches this number.' : `Checked ${date}.`,
    Glyph: CircleX,
    ink: 'text-rejected-ink',
    tone: 'border-rejected-border border-l-rejected',
    glyphTone: 'text-rejected',
    inlineTone: 'border-rejected-border bg-rejected-bg',
  },
  revoked: {
    word: 'Revoked',
    headline: () => 'Registration revoked',
    record: (date) =>
      date === undefined
        ? 'Listing withdrawn after a register check'
        : `Listing withdrawn ${date}`,
    cadence: (date) =>
      date === undefined
        ? 'Withdrawn after a register check.'
        : `Withdrawn ${date}.`,
    Glyph: ShieldOff,
    ink: 'text-revoked-ink',
    tone: 'border-revoked-border border-l-revoked',
    glyphTone: 'text-revoked',
    inlineTone: 'border-revoked-border bg-revoked-bg',
  },
}

export type VerificationBadgeVariant = 'plaque' | 'inline' | 'readout'

export type VerificationBadgeProps = {
  status: VerificationStatus
  /** Interpolated into the verified headline — never a hardcoded word. */
  profession?: string
  /**
   * The evidence, where the payload rendering the badge carries it. The public
   * search result and profile do not, so the badge omits the citation rather
   * than leaving a blank where a number belongs.
   */
  registrationNumber?: string
  /** Absent on a record imported before checks began. */
  lastCheckedAt?: Date
  variant?: VerificationBadgeVariant
  /** Where "how Verification works" points, when there is no date to show. */
  methodHref?: string
}

export function VerificationBadge({
  status,
  profession,
  registrationNumber,
  lastCheckedAt,
  variant = 'plaque',
  methodHref = '#verification',
}: VerificationBadgeProps) {
  const plate = STATUS_PLATE[status]
  const date =
    lastCheckedAt === undefined ? undefined : DATE_FORMAT.format(lastCheckedAt)
  // The label is composed from what the badge actually holds: naming a
  // registration number it was never given is the same fabrication as naming a
  // check date it does not have.
  const cited =
    registrationNumber === undefined
      ? REGISTER
      : `${REGISTER} ${registrationNumber}`
  const ariaLabel = `Verification: ${status}. ${cited}. ${plate.cadence(date)}`
  const { Glyph } = plate

  // On the Practitioner's own dashboard the badge sits inside a status
  // readout tile that already draws the border and already states the caps
  // label. All the tile wants is the glyph, the word and the state's ink.
  if (variant === 'readout') {
    return (
      <span
        role="group"
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-2.5 ${plate.ink}`}
      >
        <Glyph
          className={`size-6 shrink-0 ${plate.glyphTone}`}
          aria-hidden="true"
        />
        <span className="text-h2 font-bold tracking-tightest">
          {plate.word}
        </span>
      </span>
    )
  }

  // In a list the badge drops the date — the header states "all listings
  // re-checked weekly" once, so every row need not repeat it.
  if (variant === 'inline') {
    return (
      <span
        role="group"
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1.5 rounded-xs border py-1 pr-2.5 pl-1.5 text-[0.875rem] font-bold ${plate.inlineTone} ${plate.ink}`}
      >
        <Glyph
          className={`size-[15px] shrink-0 ${plate.glyphTone}`}
          aria-hidden="true"
        />
        {plate.word}
      </span>
    )
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-start gap-3.5 rounded-sm border border-l-4 bg-surface-raised py-4 pr-5 pl-4 shadow-sm ${plate.tone}`}
    >
      <Glyph
        className={`mt-0.5 size-6 shrink-0 ${plate.glyphTone}`}
        aria-hidden="true"
      />
      <div>
        <p className="text-title font-bold">{plate.headline(profession)}</p>
        <p className="text-meta text-text-muted">
          {REGISTER}
          {registrationNumber !== undefined && (
            <>
              {' · reg. '}
              {/* A registration number offers a break at its hyphen, and at
                  390px the plaque's second line is narrow enough for the
                  browser to take it: `reg. 01-` / `31842` cites two numbers. */}
              <span className="font-semibold whitespace-nowrap tabular-nums text-text">
                {registrationNumber}
              </span>
            </>
          )}
        </p>
        <p className="text-meta tabular-nums text-text-muted">
          {plate.record(date)}
          {/* Never an empty slot, never a fabricated date: when there is no
              check timestamp the cadence stands in, with a link to the method. */}
          {status === 'verified' && date === undefined && (
            <a href={methodHref} className="font-semibold">
              how Verification works
            </a>
          )}
        </p>
      </div>
    </div>
  )
}
