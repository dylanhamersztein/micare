import { CircleAlert, CircleCheckBig, CircleX, Info } from 'lucide-react'

import type { ComponentType, ReactNode } from 'react'

// Same anatomy as the Verification badge — hairline border, a tone edge, a
// glyph, a bold first line and a plain second — so an alert reads as the same
// species of object as a Verification record rather than a floating toast.
// Every tone carries its own glyph as well as its own colour.

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

type TonePlate = {
  /** Warning and error interrupt; info and success wait their turn. */
  role: 'alert' | 'status'
  Glyph: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>
  edge: string
  glyphTone: string
  headline: string
}

const TONE_PLATE: Readonly<Record<AlertTone, TonePlate>> = {
  info: {
    role: 'status',
    Glyph: Info,
    edge: 'border-primary-border border-l-primary',
    glyphTone: 'text-primary',
    headline: 'text-text',
  },
  success: {
    role: 'status',
    Glyph: CircleCheckBig,
    edge: 'border-verified-border border-l-verified',
    glyphTone: 'text-verified',
    headline: 'text-verified-ink',
  },
  warning: {
    role: 'alert',
    Glyph: CircleAlert,
    edge: 'border-pending-border border-l-pending',
    glyphTone: 'text-pending',
    headline: 'text-pending-ink',
  },
  error: {
    role: 'alert',
    Glyph: CircleX,
    edge: 'border-rejected-border border-l-rejected',
    glyphTone: 'text-rejected',
    headline: 'text-rejected-ink',
  },
}

export type AlertProps = {
  tone: AlertTone
  title: ReactNode
  children?: ReactNode
}

export function Alert({ tone, title, children }: AlertProps) {
  const plate = TONE_PLATE[tone]
  const { Glyph } = plate

  return (
    <div
      role={plate.role}
      className={`flex gap-3 rounded-sm border border-l-4 bg-surface-raised px-4.5 py-4 ${plate.edge}`}
    >
      <Glyph
        className={`mt-0.5 size-[21px] shrink-0 ${plate.glyphTone}`}
        aria-hidden="true"
      />
      <div>
        <p className={`text-base font-bold ${plate.headline}`}>{title}</p>
        {children !== undefined && (
          <p className="mt-0.5 text-meta text-text-body">{children}</p>
        )}
      </div>
    </div>
  )
}
