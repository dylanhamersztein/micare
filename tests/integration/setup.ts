// Integration tests run server-only modules that pull from process.env via
// src/env.server.ts at import time. Provide local-stack defaults so the
// suite runs against the Compose database without forcing every developer
// to populate DATABASE_URL in .env.local.
process.env.SUPABASE_PROJECT_REF ??= 'local-dev'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'local-dev-service-role-key'
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:54322/postgres'
process.env.PHOTO_CHECK_MOCK ??= 'true'
process.env.SUPABASE_STORAGE_MOCK ??= 'true'
process.env.AUTH_MOCK ??= 'true'
process.env.AUTH_SESSION_SECRET ??=
  'integration-test-session-secret-not-secret-0123456789'
process.env.CRON_SECRET ??= 'integration-test-cron-secret'
process.env.OPERATOR_SECRET ??= 'integration-test-operator-secret'
process.env.ALERT_MOCK ??= 'true'
process.env.NOTIFY_TOKEN_SECRET ??= 'integration-test-notify-secret'
