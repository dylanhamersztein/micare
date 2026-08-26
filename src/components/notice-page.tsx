import { CircleCheckBig, CircleAlert } from 'lucide-react'

import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from 'react'

// The frame for a screen that is the end of a journey rather than a step in
// one: a confirmed Notify-Me Subscription, an unsubscribed one, a token page
// handed a link it cannot read, a profile that is not there. Every one says
// the outcome in a word, then in a sentence, then offers one way onward — so
// they are one object with three slots rather than six hand-built pages.

export type NoticeTone = 'affirm' | 'problem'

type TonePlate = {
  Glyph: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>
  chip: string
}

const TONE_PLATE: Readonly<Record<NoticeTone, TonePlate>> = {
  affirm: {
    Glyph: CircleCheckBig,
    chip: 'border-primary-border bg-primary-soft text-primary',
  },
  problem: {
    Glyph: CircleAlert,
    chip: 'border-pending-border bg-pending-bg text-pending-ink',
  },
}

export type NoticePageProps = ComponentPropsWithoutRef<'main'> & {
  tone: NoticeTone
  /** The outcome in a word, above the heading. */
  eyebrow: ReactNode
  title: ReactNode
  children: ReactNode
}

export function NoticePage({
  tone,
  eyebrow,
  title,
  children,
  className,
  ...props
}: NoticePageProps) {
  const { Glyph, chip } = TONE_PLATE[tone]

  return (
    <main
      className={[
        'mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <p
        className={`mb-6 inline-flex items-center gap-2.5 rounded-sm border px-3.5 py-2 text-meta font-bold ${chip}`}
      >
        <Glyph className="size-5 shrink-0" aria-hidden="true" />
        {eyebrow}
      </p>
      <h1 className="font-serif text-h1 font-medium tracking-tightest text-balance">
        {title}
      </h1>
      <div className="mt-4 flex flex-col gap-4 text-text-body">{children}</div>
    </main>
  )
}
