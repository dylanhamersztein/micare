// Shared bearer-token guard for MiCare's machine- and operator-triggered
// routes. Vercel attaches `Authorization: Bearer <CRON_SECRET>` to every
// scheduled invocation; the operator attaches OPERATOR_SECRET by hand. Both
// are public URLs, so both compare the header against a configured secret.
// Pure: the caller passes the secret, so this stays unit-testable without
// importing env.server.
export function bearerAuthError(
  request: Request,
  secret: string | undefined,
  secretName: string,
): Response | null {
  if (!secret) {
    return new Response(`${secretName} not configured`, { status: 500 })
  }
  const header = request.headers.get('authorization')
  if (header !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  return null
}

export function cronAuthError(
  request: Request,
  secret: string | undefined,
): Response | null {
  return bearerAuthError(request, secret, 'CRON_SECRET')
}
