import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { submitSignup } from '../server/signup'
import { signupInputSchema } from '../signup-input'
import { PROFESSION_CODES } from '../verification'
import type { ProfessionCode, VerificationOutcome } from '../verification'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

type FormState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'invalid'; message: string }
  | { kind: 'result'; outcome: VerificationOutcome }

const PROFESSION_LABELS: Record<ProfessionCode, string> = {
  optician: 'Optician',
}

function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [professionCode, setProfessionCode] = useState<ProfessionCode>('optician')
  const [gocNumber, setGocNumber] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>({ kind: 'idle' })
  const [hydrated, setHydrated] = useState(false)

  // Set a hydration sentinel after the first client render so the e2e tests
  // can wait until React has attached event handlers before interacting with
  // the form. Without this the test can click submit before hydration, the
  // browser then submits the form natively (GET to /signup), and the page
  // reloads with state wiped.
  useEffect(() => {
    setHydrated(true)
  }, [])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsed = signupInputSchema.safeParse({
      fullName,
      professionCode,
      gocNumber,
      email,
    })
    if (!parsed.success) {
      setState({
        kind: 'invalid',
        message: parsed.error.issues[0]?.message ?? 'Please check your details.',
      })
      return
    }

    setState({ kind: 'submitting' })
    try {
      const { outcome } = await submitSignup({ data: parsed.data })
      setState({ kind: 'result', outcome })
    } catch {
      // An unexpected failure is a system issue, not a rejection (story 19).
      setState({ kind: 'result', outcome: 'pending' })
    }
  }

  if (state.kind === 'result') {
    return <ResultPanel outcome={state.outcome} />
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">List your practice on MiCare</h1>
        <p className="mt-1 text-sm text-gray-600">
          Enter your details and we&apos;ll check your GOC registration while
          you wait — it usually takes a few seconds.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
        data-testid="signup-form"
        data-hydrated={hydrated ? 'true' : undefined}
      >
        <label className="flex flex-col text-sm">
          Full name
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-1 rounded border px-2 py-1"
            data-testid="signup-full-name"
          />
        </label>

        <label className="flex flex-col text-sm">
          Profession
          <select
            value={professionCode}
            onChange={(e) => setProfessionCode(e.target.value as ProfessionCode)}
            className="mt-1 rounded border px-2 py-1"
            data-testid="signup-profession"
          >
            {PROFESSION_CODES.map((code) => (
              <option key={code} value={code}>
                {PROFESSION_LABELS[code]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          GOC number
          <input
            type="text"
            value={gocNumber}
            onChange={(e) => setGocNumber(e.target.value)}
            placeholder="01-123456 or D-17909"
            required
            className="mt-1 rounded border px-2 py-1"
            data-testid="signup-goc-number"
          />
        </label>

        <label className="flex flex-col text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 rounded border px-2 py-1"
            data-testid="signup-email"
          />
        </label>

        {state.kind === 'invalid' && (
          <p className="text-sm text-red-600" data-testid="signup-invalid">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={state.kind === 'submitting'}
          className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          data-testid="signup-submit"
        >
          {state.kind === 'submitting' ? 'Checking…' : 'Check my registration'}
        </button>
      </form>
    </div>
  )
}

function ResultPanel({ outcome }: { outcome: VerificationOutcome }) {
  if (outcome === 'verified') {
    return (
      <div className="mx-auto max-w-2xl p-8" data-testid="signup-verified">
        <h1 className="text-2xl font-bold">You&apos;re verified ✓</h1>
        <p className="mt-2 text-gray-700">
          We confirmed your registration on the GOC register. The next step is
          to set up your £29/month subscription — payment is coming shortly.
        </p>
      </div>
    )
  }

  if (outcome === 'rejected') {
    return (
      <div className="mx-auto max-w-2xl p-8" data-testid="signup-rejected">
        <h1 className="text-2xl font-bold">
          We couldn&apos;t find you on the GOC register
        </h1>
        <p className="mt-2 text-gray-700">
          MiCare only lists currently-registered professionals, so we
          can&apos;t continue your signup — and there is no charge. If you
          believe this is a mistake, check the GOC number you entered and try
          again.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-8" data-testid="signup-pending">
      <h1 className="text-2xl font-bold">We hit a technical snag</h1>
      <p className="mt-2 text-gray-700">
        This is a problem on our side, not with your registration. We&apos;ve
        recorded your details and someone will follow up shortly to finish your
        signup.
      </p>
    </div>
  )
}
