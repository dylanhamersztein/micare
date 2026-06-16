// The magic-link orchestrator core. requestMagicLinkImpl turns an email into
// either a clickable dev link (AUTH_MOCK) or a Supabase signInWithOtp send;
// consumeMagicLinkImpl verifies the token and resolves the Practitioner.
// Cookie handling is NOT here — the server-route handler (auth-callback.ts)
// sets the session. Integration tests drive the mock branch directly; the
// real branch mirrors the Stripe real-path (implemented, env-gated, not part
// of the offline suite). See ADR-0006.

import { createClient } from '@supabase/supabase-js'

import { env } from '../env.server'
import { signMockToken, verifyMockToken } from './magic-link-token'
import { findPractitionerByEmail } from './practitioner-account'

const TOKEN_TTL_MS = 15 * 60 * 1000

// Mock falls back to a fixed dev secret so AUTH_SESSION_SECRET can stay unset
// locally; the real branch never reaches signMockToken.
const DEV_TOKEN_SECRET =
  env.AUTH_SESSION_SECRET ?? 'micare-dev-magic-link-secret-0123456789abcdef'

export type RequestMagicLinkResult =
  | { kind: 'mock'; magicLinkPath: string }
  | { kind: 'sent' }

export type ConsumeMagicLinkResult =
  | { kind: 'ok'; practitionerId: string; email: string }
  | { kind: 'invalid' }

let supabaseAuthClient: ReturnType<typeof createClient> | undefined

function getSupabaseAuthClient(): ReturnType<typeof createClient> {
  if (!supabaseAuthClient) {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_ANON_KEY are required when AUTH_MOCK is false',
      )
    }
    supabaseAuthClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return supabaseAuthClient
}

export async function requestMagicLinkImpl(
  email: string,
): Promise<RequestMagicLinkResult> {
  const normalized = email.trim().toLowerCase()

  if (env.AUTH_MOCK) {
    // Do not check practitioner existence here — that would let a stranger
    // enumerate registered emails. The callback gates on the lookup instead.
    const token = signMockToken(
      normalized,
      Date.now() + TOKEN_TTL_MS,
      DEV_TOKEN_SECRET,
    )
    return {
      kind: 'mock',
      magicLinkPath: `/auth/callback?token=${encodeURIComponent(token)}`,
    }
  }

  const { error } = await getSupabaseAuthClient().auth.signInWithOtp({
    email: normalized,
    options: { emailRedirectTo: `${env.APP_URL}/auth/callback` },
  })
  if (error) {
    throw new Error(`Supabase signInWithOtp failed: ${error.message}`)
  }
  return { kind: 'sent' }
}

export async function consumeMagicLinkImpl(
  token: string,
): Promise<ConsumeMagicLinkResult> {
  let email: string | null

  if (env.AUTH_MOCK) {
    email = verifyMockToken(token, DEV_TOKEN_SECRET, Date.now())
  } else {
    const { data, error } = await getSupabaseAuthClient().auth.verifyOtp({
      type: 'email',
      token_hash: token,
    })
    email = error ? null : (data.user?.email ?? null)
  }

  if (!email) return { kind: 'invalid' }

  const account = await findPractitionerByEmail(email)
  if (!account) return { kind: 'invalid' }

  return { kind: 'ok', practitionerId: account.id, email: account.email }
}
