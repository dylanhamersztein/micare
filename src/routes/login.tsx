import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import {
  Alert,
  Button,
  Field,
  STANDALONE_LINK_CLASSES,
  TEXT_LINK_CLASSES,
  TextInput,
} from '#/components'
import { requestMagicLink } from '../server/auth'

const searchSchema = z.object({
  error: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: (raw) => searchSchema.parse(raw),
  component: LoginPage,
})

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'sent' }
  | { kind: 'mock'; magicLinkPath: string }
  | { kind: 'error'; message: string }

function LoginPage() {
  const { error } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setState({ kind: 'submitting' })
    try {
      const result = await requestMagicLink({ data: { email } })
      if (result.kind === 'mock') {
        setState({ kind: 'mock', magicLinkPath: result.magicLinkPath })
      } else {
        setState({ kind: 'sent' })
      }
    } catch {
      setState({
        kind: 'error',
        message: 'Please enter a valid email address.',
      })
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6 sm:py-12">
      <header>
        <Link to="/" className={STANDALONE_LINK_CLASSES}>
          ← MiCare home
        </Link>
        <h1 className="mt-3 font-serif text-h1 font-medium tracking-tightest text-balance">
          Sign in to MiCare
        </h1>
        <p className="mt-2 text-text-body">
          Enter your email and we will send you a one-time sign-in link. There
          is no password to remember.
        </p>
      </header>

      {error === 'invalid-link' && (
        <div className="mt-6" data-testid="login-link-error">
          <Alert tone="warning" title="That link no longer works">
            Sign-in links expire, and each one can only be used once. Request a
            new one below.
          </Alert>
        </div>
      )}

      {state.kind === 'sent' ? (
        <div className="mt-6" data-testid="login-sent">
          <Alert tone="success" title="Check your email">
            If that address belongs to a MiCare account, a sign-in link is on
            its way. It works once, and only for a short while.
          </Alert>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-6 flex flex-col gap-5 rounded-md border border-border bg-surface-raised p-5 sm:p-6"
          data-testid="login-form"
          data-hydrated={hydrated ? 'true' : undefined}
        >
          <Field
            label="Email address"
            help="The address you signed up with."
            requirement="required"
            error={
              state.kind === 'error' ? (
                <span data-testid="login-invalid">{state.message}</span>
              ) : undefined
            }
          >
            <TextInput
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.co.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="login-email"
            />
          </Field>

          <Button
            type="submit"
            size="lg"
            loading={state.kind === 'submitting'}
            loadingLabel="Sending…"
            data-testid="login-submit"
          >
            Email me a link
          </Button>
        </form>
      )}

      {state.kind === 'mock' && (
        <div className="mt-6" data-testid="login-mock-panel">
          <Alert tone="info" title="Dev mode (AUTH_MOCK=true)">
            No email was sent. Use your one-time sign-in link:{' '}
            {/* Plain anchor (not router Link) so it triggers a full-page
                navigation to the server-route handler, exactly like a real
                emailed link. */}
            <a
              href={state.magicLinkPath}
              className={TEXT_LINK_CLASSES}
              data-testid="dev-magic-link"
            >
              Sign in
            </a>
          </Alert>
        </div>
      )}

      <p className="mt-6 text-meta text-text-muted">
        Not listed yet?{' '}
        <Link to="/signup" className={TEXT_LINK_CLASSES}>
          List your Practice
        </Link>
        .
      </p>
    </main>
  )
}
