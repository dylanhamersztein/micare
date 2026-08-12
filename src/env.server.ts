import { z } from 'zod'

const boolFromEnv = z
  .enum(['true', 'false'])
  .default('true')
  .transform((v) => v === 'true')

const schema = z
  .object({
    SUPABASE_PROJECT_REF: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    DATABASE_URL: z.string().url(),

    GOC_MOCK: boolFromEnv,
    GOC_API_KEY: z.string().optional(),

    // Mirrors the client-side VITE_STRIPE_MOCK flag. When true, the
    // checkout orchestrator and the (non-existent in mock) webhook flow
    // are short-circuited and no Stripe API call is made.
    VITE_STRIPE_MOCK: boolFromEnv,
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_ID: z.string().optional(),

    // The origin used to construct Stripe success_url / cancel_url, e.g.
    // http://localhost:3000 in dev or https://micare.co.uk in prod.
    APP_URL: z.string().url().optional(),

    RESEND_API_KEY: z.string().optional(),

    // Magic-link auth. Mirrors the other *_MOCK flags: when true (the
    // default) no email is sent — the login flow returns a clickable dev
    // magic-link and the callback verifies a locally-signed token, so the
    // whole suite runs offline. When false, Supabase Auth sends/verifies the
    // link (see ADR-0006).
    AUTH_MOCK: boolFromEnv,
    // Password h3 uses to seal the `micare_session` cookie (>= 32 chars).
    // Optional in mock/dev (src/server/session.ts falls back to a dev
    // constant); required when AUTH_MOCK is false.
    AUTH_SESSION_SECRET: z.string().min(32).optional(),
    // Supabase anon key for the real signInWithOtp / verifyOtp client.
    // Required only when AUTH_MOCK is false.
    SUPABASE_ANON_KEY: z.string().optional(),

    PHOTO_CHECK_MOCK: boolFromEnv,
    SUPABASE_STORAGE_MOCK: boolFromEnv,
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default('practitioner-photos'),

    // Slice 11 — re-verification cron + stale alert (ADR-0007).
    // Guards the /api/cron/* routes; Vercel Cron sends it as a bearer token.
    // Optional so mock/local runs (no cron) still boot; the routes return 500
    // when it is unset and 401 on a mismatch.
    CRON_SECRET: z.string().optional(),
    // Recipient for the daily stale-verification digest. Required only when
    // ALERT_MOCK is false (see superRefine below).
    OPERATOR_ALERT_EMAIL: z.string().email().optional(),
    // Follows the *_MOCK idiom: when true (default) the digest is a log line
    // only and no Resend call is made, keeping the suite offline.
    ALERT_MOCK: boolFromEnv,
    // Visible practitioners whose last_verified_at is older than this many
    // days are surfaced by the daily alert.
    STALE_VERIFICATION_DAYS: z.coerce.number().int().positive().default(14),

    // Slice 5 — Booking Link click tracking. Salts the visitor hash stored in
    // `clickthroughs` so the raw IP cannot be recovered by brute-forcing the
    // address space. Optional like AUTH_SESSION_SECRET: local/mock runs fall
    // back to a fixed dev constant (src/server/click-tracking-impl.ts).
    // Changing it in production resets every in-flight dedup window.
    CLICK_TRACKING_SALT: z.string().optional(),

    // Slice 15 — Notify-Me capture. Signs the confirm / unsubscribe links so
    // they are non-guessable without storing a token per row. Optional like
    // CLICK_TRACKING_SALT: local/mock runs fall back to a fixed dev constant
    // (src/server/notify-impl.ts). Rotating it in production invalidates every
    // link already sitting in a consumer's inbox.
    NOTIFY_TOKEN_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.GOC_MOCK && !env.GOC_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOC_API_KEY'],
        message: 'Required when GOC_MOCK is false',
      })
    }
    if (!env.VITE_STRIPE_MOCK) {
      for (const key of [
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'STRIPE_PRICE_ID',
        'APP_URL',
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'Required when VITE_STRIPE_MOCK is false',
          })
        }
      }
    }
    if (!env.SUPABASE_STORAGE_MOCK && !env.SUPABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['SUPABASE_URL'],
        message: 'Required when SUPABASE_STORAGE_MOCK is false',
      })
    }
    if (!env.AUTH_MOCK) {
      if (!env.AUTH_SESSION_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['AUTH_SESSION_SECRET'],
          message: 'Required when AUTH_MOCK is false',
        })
      }
      if (!env.SUPABASE_ANON_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['SUPABASE_ANON_KEY'],
          message: 'Required when AUTH_MOCK is false',
        })
      }
      if (!env.APP_URL) {
        ctx.addIssue({
          code: 'custom',
          path: ['APP_URL'],
          message: 'Required when AUTH_MOCK is false (magic-link redirect URL)',
        })
      }
    }
    if (!env.ALERT_MOCK) {
      if (!env.OPERATOR_ALERT_EMAIL) {
        ctx.addIssue({
          code: 'custom',
          path: ['OPERATOR_ALERT_EMAIL'],
          message: 'Required when ALERT_MOCK is false',
        })
      }
      if (!env.RESEND_API_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['RESEND_API_KEY'],
          message: 'Required when ALERT_MOCK is false',
        })
      }
    }
  })

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors
  console.error('Invalid environment variables:')
  for (const [key, messages] of Object.entries(fieldErrors)) {
    for (const message of messages) {
      console.error(`  ${key}: ${message}`)
    }
  }
  throw new Error('Invalid environment — see logged field errors above')
}

export const env = parsed.data
export type ServerEnv = typeof env
