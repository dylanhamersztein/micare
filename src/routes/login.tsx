import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

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
    <div className="mx-auto max-w-md p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Sign in to MiCare</h1>
        <p className="mt-1 text-sm text-gray-600">
          Enter your email and we&apos;ll send you a one-time sign-in link. No
          password needed.
        </p>
      </header>

      {error === 'invalid-link' && (
        <div
          className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm"
          data-testid="login-link-error"
        >
          That sign-in link is invalid or has expired. Request a new one below.
        </div>
      )}

      {state.kind === 'sent' ? (
        <div
          className="rounded border border-green-300 bg-green-50 p-3 text-sm"
          data-testid="login-sent"
        >
          Check your email for a sign-in link.
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
          data-testid="login-form"
          data-hydrated={hydrated ? 'true' : undefined}
        >
          <label className="flex flex-col text-sm">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 rounded border px-2 py-1"
              data-testid="login-email"
            />
          </label>

          {state.kind === 'error' && (
            <p className="text-sm text-red-600" data-testid="login-invalid">
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={state.kind === 'submitting'}
            className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            data-testid="login-submit"
          >
            {state.kind === 'submitting' ? 'Sending…' : 'Email me a link'}
          </button>
        </form>
      )}

      {state.kind === 'mock' && (
        <div
          className="mt-4 rounded border border-blue-300 bg-blue-50 p-3 text-sm"
          data-testid="login-mock-panel"
        >
          <p className="mb-2 font-semibold">Dev mode (AUTH_MOCK=true)</p>
          <p>
            No email was sent. Use your one-time sign-in link:{' '}
            {/* Plain anchor (not router Link) so it triggers a full-page
                navigation to the server-route handler, exactly like a real
                emailed link. */}
            <a
              href={state.magicLinkPath}
              className="underline"
              data-testid="dev-magic-link"
            >
              Sign in
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
