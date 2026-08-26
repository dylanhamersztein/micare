import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import {
  Alert,
  Button,
  Field,
  SignupOutcome,
  STANDALONE_LINK_CLASSES,
  TextInput,
  VerificationWait,
  withUnbrokenFigures,
} from '#/components'
import { GOC_NUMBER_HELP } from '../goc-number'
import { startCheckout } from '../server/checkout'
import { submitSignup } from '../server/signup'
import { signupInputSchema } from '../signup-input'
import type { SignupInput } from '../signup-input'
import { PROFESSION_CODES } from '../verification'
import type { ProfessionCode, VerificationOutcome } from '../verification'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

/** The fields a validation issue can land on, in the order they are asked. */
type FieldName = 'fullName' | 'gocNumber' | 'email'

const FIELD_NAMES: ReadonlyArray<string> = ['fullName', 'gocNumber', 'email']

type FormState =
  | { kind: 'idle' }
  | { kind: 'submitting'; gocNumber: string }
  | { kind: 'invalid'; field: FieldName | null; message: string }
  | { kind: 'result'; outcome: VerificationOutcome; input: SignupInput | null }
  | { kind: 'checkout-error'; message: string; input: SignupInput }

const PROFESSION_LABELS: Record<ProfessionCode, string> = {
  optician: 'Optician',
}

// Phase 1 has exactly one Profession, and one option is not a choice — a
// select with a single item reads as a decision the Practitioner has to make
// and then cannot. So it is stated as a fact, carried in a hidden field, and
// the register it implies is named out loud. The select returns on the day a
// second regulator ships.
const [PHASE_ONE_PROFESSION] = PROFESSION_CODES

function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const professionCode: ProfessionCode = PHASE_ONE_PROFESSION
  const [gocNumber, setGocNumber] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>({ kind: 'idle' })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  async function runCheck(input: SignupInput) {
    setState({ kind: 'submitting', gocNumber: input.gocNumber })
    try {
      const { outcome } = await submitSignup({ data: input })
      setState({ kind: 'result', outcome, input })
    } catch {
      setState({ kind: 'result', outcome: 'pending', input: null })
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsed = signupInputSchema.safeParse({
      fullName,
      professionCode,
      gocNumber,
      email,
    })
    if (!parsed.success) {
      // The first issue, as before — but now shown against the field it is
      // about, where a screen reader reaches it through aria-describedby.
      const [issue] = parsed.error.issues
      const path = String(issue.path[0])
      setState({
        kind: 'invalid',
        field: FIELD_NAMES.includes(path) ? (path as FieldName) : null,
        message: issue.message,
      })
      return
    }

    await runCheck(parsed.data)
  }

  async function onContinueToPayment(input: SignupInput) {
    setState({ kind: 'submitting', gocNumber: input.gocNumber })
    try {
      const result = await startCheckout({ data: input })
      if (result.kind === 'stripe') {
        window.location.href = result.checkoutUrl
        return
      }
      await router.navigate({ to: result.redirectTo })
    } catch (error) {
      setState({
        kind: 'checkout-error',
        message:
          error instanceof Error ? error.message : 'Could not start checkout.',
        input,
      })
    }
  }

  if (state.kind === 'checkout-error') {
    return (
      <main
        className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16"
        data-testid="checkout-error"
      >
        <h1 className="font-serif text-h1 font-medium tracking-tightest text-balance">
          We couldn&apos;t start payment
        </h1>
        <div className="mt-4 flex flex-col gap-5 text-text-body">
          <p>
            Your registration is verified — this is the payment step, and it is
            our end that failed. Nothing has been charged.
          </p>
          <Alert tone="error" title="What went wrong">
            {state.message}
          </Alert>
        </div>
        <div className="mt-7">
          <Button
            size="lg"
            onClick={() => onContinueToPayment(state.input)}
            data-testid="checkout-retry"
          >
            Try again
          </Button>
        </div>
      </main>
    )
  }

  if (state.kind === 'result') {
    const profession = PROFESSION_LABELS[professionCode]
    const input = state.input

    if (state.outcome === 'verified') {
      return (
        <SignupOutcome
          outcome="verified"
          profession={profession}
          fullName={input?.fullName}
          registrationNumber={input?.gocNumber}
          data-testid="signup-verified"
        >
          {input ? (
            <Button
              size="lg"
              onClick={() => onContinueToPayment(input)}
              data-testid="signup-continue-to-payment"
            >
              Continue to payment
            </Button>
          ) : (
            <p className="text-meta text-text-muted">
              Re-enter your details to continue to payment.
            </p>
          )}
        </SignupOutcome>
      )
    }

    if (state.outcome === 'rejected') {
      return (
        <SignupOutcome
          outcome="rejected"
          profession={profession}
          fullName={input?.fullName}
          registrationNumber={input?.gocNumber}
          data-testid="signup-rejected"
        >
          {/* Back to the form rather than back to the route: the details are
              still in state, and re-navigating to /signup from /signup would
              leave this panel exactly where it is. */}
          <Button size="lg" onClick={() => setState({ kind: 'idle' })}>
            Check the number and try again
          </Button>
          <Link to="/" className={STANDALONE_LINK_CLASSES}>
            Leave it for now
          </Link>
        </SignupOutcome>
      )
    }

    return (
      <SignupOutcome
        outcome="pending"
        profession={profession}
        fullName={input?.fullName}
        registrationNumber={input?.gocNumber}
        data-testid="signup-pending"
      >
        {input && (
          <Button size="lg" onClick={() => runCheck(input)}>
            Try the check again
          </Button>
        )}
        <Button
          variant={input ? 'ghost' : 'primary'}
          size="lg"
          onClick={() => setState({ kind: 'idle' })}
        >
          Back to your details
        </Button>
      </SignupOutcome>
    )
  }

  const invalid = state.kind === 'invalid' ? state : null

  function errorFor(field: FieldName) {
    return invalid?.field === field ? (
      <span data-testid="signup-invalid">{invalid.message}</span>
    ) : undefined
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <header>
        <Link to="/" className={STANDALONE_LINK_CLASSES}>
          ← MiCare home
        </Link>
        <h1 className="mt-3 font-serif text-h1 font-medium tracking-tightest text-balance">
          List your Practice on MiCare
        </h1>
        <p className="mt-2 max-w-[56ch] text-text-body">
          Enter your details and we will check them against the General Optical
          Council register while you wait. Nothing is charged until that check
          clears.
        </p>
      </header>

      {state.kind === 'submitting' ? (
        <div className="mt-7">
          <VerificationWait registrationNumber={state.gocNumber} />
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-7 flex flex-col gap-5 rounded-md border border-border bg-surface-raised p-5 sm:p-6"
          data-testid="signup-form"
          data-hydrated={hydrated ? 'true' : undefined}
        >
          <Field
            label="Full name"
            help="As it appears on the GOC register."
            requirement="required"
            error={errorFor('fullName')}
          >
            <TextInput
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              data-testid="signup-full-name"
            />
          </Field>

          <div className="flex flex-col">
            <p className="mb-1.5 text-label font-bold tracking-caps text-text-body uppercase">
              Profession
            </p>
            <p className="text-base font-semibold text-text">
              {PROFESSION_LABELS[professionCode]}
            </p>
            <p className="mt-1 text-meta text-text-muted">
              Checked against the General Optical Council register. MiCare
              covers opticians in Phase 1.
            </p>
            <input
              type="hidden"
              name="professionCode"
              value={professionCode}
              data-testid="signup-profession"
            />
          </div>

          <Field
            label="GOC registration number"
            help={withUnbrokenFigures(GOC_NUMBER_HELP)}
            requirement="required"
            error={errorFor('gocNumber')}
          >
            <TextInput
              name="gocNumber"
              className="tabular-nums"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              value={gocNumber}
              onChange={(e) => setGocNumber(e.target.value)}
              required
              data-testid="signup-goc-number"
            />
          </Field>

          <Field
            label="Email address"
            help="Where your sign-in links and your monthly summary go."
            requirement="required"
            error={errorFor('email')}
          >
            <TextInput
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.co.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="signup-email"
            />
          </Field>

          {invalid?.field === null && (
            <div data-testid="signup-invalid">
              <Alert tone="error" title={invalid.message} />
            </div>
          )}

          <Button type="submit" size="lg" data-testid="signup-submit">
            Check my registration
          </Button>
        </form>
      )}
    </main>
  )
}
