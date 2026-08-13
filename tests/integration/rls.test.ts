import { Client } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import { db } from '../../src/server/db'

// The local Compose stack is vanilla Postgres, so it has none of hosted
// Supabase's `anon` / `authenticated` roles to point at. This stands in for
// them: an unprivileged role holding the same blanket `select` grant hosted
// Supabase hands `anon`. If the perimeter is real, the grant buys it nothing.
const PROBE_ROLE = 'micare_rls_probe'

async function publicTablesWithoutRls(): Promise<Array<string>> {
  const result = await db.query<{ relname: string }>(
    `select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and not c.relrowsecurity
      order by c.relname`,
  )
  return result.rows.map((row) => row.relname)
}

async function policiesOnPublicTables(): Promise<Array<string>> {
  const result = await db.query<{ policy: string }>(
    `select tablename || '.' || policyname as policy
       from pg_policies
      where schemaname = 'public'
      order by 1`,
  )
  return result.rows.map((row) => row.policy)
}

async function rowsVisibleToProbeRole(table: string): Promise<number> {
  await db.query(
    `do $$ begin
       if not exists (select from pg_roles where rolname = '${PROBE_ROLE}') then
         create role ${PROBE_ROLE} nologin;
       end if;
     end $$`,
  )
  await db.query(`grant usage on schema public to ${PROBE_ROLE}`)
  await db.query(`grant select on public.${table} to ${PROBE_ROLE}`)

  // A pooled query can land on any connection, so `set role` and the select
  // that must run under it share one client of their own.
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(`set role ${PROBE_ROLE}`)
    const result = await client.query<{ count: string }>(
      `select count(*)::text as count from public.${table}`,
    )
    return Number(result.rows[0].count)
  } finally {
    await client.end()
  }
}

afterAll(async () => {
  // Guarded because `revoke ... from` errors on a role that was never created,
  // which happens whenever this file's probe test is filtered out.
  await db.query(
    `do $$ begin
       if exists (select from pg_roles where rolname = '${PROBE_ROLE}') then
         revoke all on all tables in schema public from ${PROBE_ROLE};
         revoke usage on schema public from ${PROBE_ROLE};
         drop role ${PROBE_ROLE};
       end if;
     end $$`,
  )
})

describe('row level security perimeter', () => {
  it('is enabled on every table in the public schema', async () => {
    expect(await publicTablesWithoutRls()).toEqual([])
  })

  it('grants nothing back: no policies on any public table', async () => {
    expect(await policiesOnPublicTables()).toEqual([])
  })

  it('hides every row from a role holding select, the way hosted anon is held off', async () => {
    const seeded = await db.query<{ count: string }>(
      'select count(*)::text as count from public.practitioners',
    )
    expect(Number(seeded.rows[0].count)).toBeGreaterThan(0)

    expect(await rowsVisibleToProbeRole('practitioners')).toBe(0)
  })
})
