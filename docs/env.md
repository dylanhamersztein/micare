# Environment variables

## Convention

Two prefixes, one rule each:

| Prefix | Read by | Where it ends up | Examples |
|---|---|---|---|
| _(none)_ | server only | `process.env`, server bundle | `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `GOC_API_KEY` |
| `VITE_` | client and server | `import.meta.env`, inlined into the browser bundle at build time | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY` |

**The rule:** anything `VITE_`-prefixed is public. If a value would compromise security when read by an attacker, it must not have the `VITE_` prefix.

Vite inlines `VITE_` vars at build time via string substitution — they ship to the browser whether or not any code reads them.

## Mock toggles

Local dev defaults to mocked external services so a fresh checkout never hits real third parties:

| Var | Default in `.env.example` | What it gates |
|---|---|---|
| `GOC_MOCK` | `true` | When true, the verification module returns canned regulator responses instead of scraping `str.optical.org`. |
| `VITE_STRIPE_MOCK` | `true` | When true, the client-side Stripe layer renders mock checkout / portal flows instead of calling the real Stripe SDK. |

Flip a mock to `false` only when you have a real key in the same env file. `src/env.server.ts` enforces this for `GOC_MOCK`: setting it to `false` without `GOC_API_KEY` set fails server boot.

## Files

| File | Tracked? | Purpose |
|---|---|---|
| `.env.example` | yes | Canonical list of every var the app reads. Placeholder values only. |
| `.env.local` | no (gitignored) | Real values for local dev. Copy from `.env.example`. |
| `.env`, `.env.*` | no (gitignored) | Any other env-file variant. The repo's `.gitignore` ignores all `.env*` except `.env.example`. |

When you add a new env var, add it to `.env.example` in the same commit. That's how the convention stays honest.

## Validation

`src/env.server.ts` parses `process.env` with `zod` at server boot. It fails loud — the server refuses to start with a clear list of missing or malformed vars — rather than producing confusing runtime errors later. Import the typed `env` object from there in any server-side code.

Client-side vars are statically inlined by Vite. Type them via `vite-env.d.ts` (TanStack Start defaults) — runtime validation can be added per call site when a slice actually consumes a new `VITE_` var.
