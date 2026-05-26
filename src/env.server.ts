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
