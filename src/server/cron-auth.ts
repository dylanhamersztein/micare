// Shared guard for the Vercel Cron routes (ADR-0007). Vercel attaches
// `Authorization: Bearer <CRON_SECRET>` to every scheduled invocation; we
// compare it against the configured secret so the public /api/cron/* routes
// cannot be triggered by anyone else. Pure: the caller passes the secret so
// this stays unit-testable without importing env.server.
export function cronAuthError(
  request: Request,
  secret: string | undefined,
): Response | null {
  if (!secret) {
    return new Response('CRON_SECRET not configured', { status: 500 })
  }
  const header = request.headers.get('authorization')
  if (header !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  return null
}
