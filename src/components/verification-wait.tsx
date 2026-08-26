import { Check, LoaderCircle } from 'lucide-react'

// The four or five seconds signup spends on the GOC register is the entire
// proposition happening in front of the Practitioner, so it is not a spinner
// over a greyed page — it is a three-line record of what is being done, in the
// order it is being done, naming the register and the number.
//
// Two rules hold it honest. There is no percentage and no progress bar: the
// register never tells us how far along it is, and a bar that stalls at 80%
// reads as broken. And the steps are the stages of the request, not a live
// readout — nothing here polls the server, so nothing pretends to.

const REGISTER = 'General Optical Council'

type StepState = 'done' | 'running' | 'waiting'

/** The state in a word, because a tone of green is not a state to everyone. */
const STATE_WORD: Readonly<Record<StepState, string>> = {
  done: 'Read',
  running: 'Checking…',
  waiting: 'Waiting',
}

const STATE_TONE: Readonly<Record<StepState, string>> = {
  done: 'text-verified-ink',
  running: 'text-text',
  waiting: 'text-text-muted',
}

export type VerificationWaitProps = {
  /** The number being matched — shown, because the wait shows its working. */
  registrationNumber: string
}

const FIGURE_CLASSES = 'font-semibold tabular-nums text-text'

export function VerificationWait({
  registrationNumber,
}: VerificationWaitProps) {
  const steps: ReadonlyArray<{ label: string; state: StepState }> = [
    { label: 'Registration number read', state: 'done' },
    { label: `Matching the live ${REGISTER} register`, state: 'running' },
    { label: 'Confirming your name and registration status', state: 'waiting' },
  ]

  return (
    <section
      className="rounded-md border border-border bg-surface-raised p-5 sm:p-6"
      data-testid="signup-checking"
    >
      <p className="text-label font-bold tracking-caps text-text-muted uppercase">
        Verification
      </p>
      <h2 className="mt-2 font-serif text-h2 font-semibold tracking-tightest">
        Checking the GOC register
      </h2>
      <p className="mt-2 max-w-[56ch] text-text-body">
        We are matching{' '}
        <span className={FIGURE_CLASSES}>{registrationNumber}</span> against the{' '}
        {REGISTER}&apos;s public register. This usually takes a few seconds.
      </p>

      <ol className="mt-5 flex flex-col">
        {steps.map(({ label, state }) => (
          <li
            key={label}
            // One region, on the line that is actually happening — not one per
            // row, which announces the whole list three times over.
            aria-live={state === 'running' ? 'polite' : undefined}
            className="flex items-center justify-between gap-4 border-t border-hairline py-3 first:border-t-0 first:pt-0"
          >
            <span className="flex items-center gap-2.5 text-meta text-text-body">
              {state === 'done' && (
                <Check
                  className="size-[19px] shrink-0 text-verified"
                  aria-hidden="true"
                />
              )}
              {state === 'running' && (
                <LoaderCircle
                  className="size-[19px] shrink-0 animate-spin text-primary"
                  aria-hidden="true"
                />
              )}
              {state === 'waiting' && (
                <span
                  className="size-[19px] shrink-0 rounded-full border border-border-strong"
                  aria-hidden="true"
                />
              )}
              {label}
            </span>
            <span
              className={`shrink-0 text-meta font-semibold ${STATE_TONE[state]}`}
            >
              {state === 'done' ? (
                <span className={FIGURE_CLASSES}>{registrationNumber}</span>
              ) : (
                STATE_WORD[state]
              )}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-5 text-meta text-text-muted">
        We read the public register only. We never ask for your GOC login, and
        we do not contact your employer.
      </p>
    </section>
  )
}
