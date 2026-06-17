// GET /auth/callback — the magic-link landing. Pulled out of the route file
// so it mirrors webhook-handler.ts. Reads the token, consumes it, mints the
// session cookie, and 302s to /dashboard. On any failure it redirects to the
// login page with an error marker. setSession writes the sealed cookie onto
// the request's h3 response; the 302 it rides on is a non-ok response, so the
// Set-Cookie header is merged by the Start runtime.

import { consumeMagicLinkImpl } from './auth-impl'
import { setSession } from './session'

function redirectTo(path: string): Response {
  return new Response(null, { status: 302, headers: { location: path } })
}

export async function handleAuthCallback(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return redirectTo('/login?error=invalid-link')

  const result = await consumeMagicLinkImpl(token)
  if (result.kind !== 'ok') return redirectTo('/login?error=invalid-link')

  await setSession({
    practitionerId: result.practitionerId,
    email: result.email,
  })
  return redirectTo('/dashboard')
}
