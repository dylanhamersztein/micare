// Stateless, signed links for the Notify-Me double-opt-in flow. Mirrors
// src/server/magic-link-token.ts: the payload is public but HMAC-signed, so a
// consumer can confirm or unsubscribe from an email link with no account and
// no session, while a guessed id gets them nothing.

import { createHmac, timingSafeEqual } from 'node:crypto'

export type NotifyTokenPurpose = 'confirm' | 'unsubscribe'

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function signNotifyToken(
  subscriptionId: string,
  purpose: NotifyTokenPurpose,
  secret: string,
): string {
  const payload = `${purpose}:${subscriptionId}`
  const encoded = Buffer.from(payload, 'utf8').toString('base64url')
  return `${encoded}.${sign(payload, secret)}`
}

export function verifyNotifyToken(
  token: string,
  purpose: NotifyTokenPurpose,
  secret: string,
): string | null {
  const [encoded, providedSig] = token.split('.')
  if (!encoded || !providedSig) return null

  const payload = Buffer.from(encoded, 'base64url').toString('utf8')
  const expectedSig = sign(payload, secret)
  const a = Buffer.from(providedSig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const prefix = `${purpose}:`
  if (!payload.startsWith(prefix)) return null
  return payload.slice(prefix.length)
}
