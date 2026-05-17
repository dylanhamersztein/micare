import { z } from "zod";

const boolFromEnv = z
  .enum(["true", "false"])
  .default("true")
  .transform((v) => v === "true");

const schema = z
  .object({
    SUPABASE_PROJECT_REF: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    DATABASE_URL: z.string().url(),

    GOC_MOCK: boolFromEnv,
    GOC_API_KEY: z.string().optional(),

    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    RESEND_API_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.GOC_MOCK && !env.GOC_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["GOC_API_KEY"],
        message: "Required when GOC_MOCK is false",
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error("Invalid environment variables:");
  for (const [key, messages] of Object.entries(fieldErrors)) {
    for (const message of messages ?? []) {
      console.error(`  ${key}: ${message}`);
    }
  }
  throw new Error("Invalid environment — see logged field errors above");
}

export const env = parsed.data;
export type ServerEnv = typeof env;
