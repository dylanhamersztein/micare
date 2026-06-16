// AUTH_MOCK-only magic-link token. Lets the dev/test flow "consume" a link
// without Supabase: signMockToken embeds the email + expiry and HMACs them;
// verifyMockToken checks the signature (timing-safe) and expiry, returning
// the email or null. Takes the secret as a parameter so this module never
// imports env.server and stays unit-testable. The real path uses Supabase
// verifyOtp instead (see src/server/auth-impl.ts).

import { createHmac, timingSafeEqual } from 'node:crypto'

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function signMockToken(
  email: string,
  expiresAtMs: number,
  secret: string,
): string {
  const payload = `${email}:${expiresAtMs}`
  const encoded = Buffer.from(payload, 'utf8').toString('base64url')
  return `${encoded}.${sign(payload, secret)}`
}

export function verifyMockToken(
  token: string,
  secret: string,
  nowMs: number,
): string | null {
  const [encoded, providedSig] = token.split('.')
  if (!encoded || !providedSig) return null

  let payload: string
  try {
    payload = Buffer.from(encoded, 'base64url').toString('utf8')
  } catch {
    return null
  }

  const expectedSig = sign(payload, secret)
  const a = Buffer.from(providedSig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const sep = payload.lastIndexOf(':')
  if (sep === -1) return null
  const email = payload.slice(0, sep)
  const expiresAtMs = Number(payload.slice(sep + 1))
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) return null

  return email
}
