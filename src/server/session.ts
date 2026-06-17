// MiCare's own sealed session cookie (ADR-0006). Supabase proves email
// ownership; this cookie — sealed + signed by h3 via TanStack Start's
// useSession — carries { practitionerId, email } for the session lifetime.
// readSession/setSession/clearSession are the only places the cookie is
// touched. Requires the per-request server runtime; not callable from a
// browser bundle.

import { useSession } from '@tanstack/react-start/server'

import { env } from '../env.server'

export type MicareSession = { practitionerId: string; email: string }

const COOKIE_NAME = 'micare_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

// useSession requires a >= 32-char password. AUTH_SESSION_SECRET is optional
// in mock/dev (env.server.ts only requires it when AUTH_MOCK is false), so
// fall back to a fixed dev constant locally.
const DEV_SESSION_SECRET = 'micare-dev-insecure-session-secret-change-me!!'

function sessionConfig() {
  return {
    name: COOKIE_NAME,
    password: env.AUTH_SESSION_SECRET ?? DEV_SESSION_SECRET,
    maxAge: MAX_AGE_SECONDS,
    cookie: {
      httpOnly: true,
      sameSite: 'lax' as const,
      // No HTTPS in local dev (AUTH_MOCK=true); prod sets AUTH_MOCK=false.
      secure: !env.AUTH_MOCK,
      path: '/',
    },
  }
}

export async function setSession(data: MicareSession): Promise<void> {
  const session = await useSession<MicareSession>(sessionConfig())
  await session.update(data)
}

export async function readSession(): Promise<MicareSession | null> {
  const session = await useSession<MicareSession>(sessionConfig())
  // useSession types `.data` as Partial<MicareSession>; narrow it back to a
  // full MicareSession by guarding both fields before returning.
  const { practitionerId, email } = session.data
  if (!practitionerId || !email) return null
  return { practitionerId, email }
}

export async function clearSession(): Promise<void> {
  const session = await useSession<MicareSession>(sessionConfig())
  await session.clear()
}
