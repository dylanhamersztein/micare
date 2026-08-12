// Absolute URLs for links that leave the app — every one of them so far ends
// up in an email, where a path alone is useless. APP_URL is optional in
// mock/dev (env.server.ts), so localhost is the fallback rather than a boot
// failure; the *_MOCK flows that run without it never send real mail.

import { env } from '../env.server'

export function absoluteUrl(path: string): string {
  return `${env.APP_URL ?? 'http://localhost:3000'}${path}`
}
