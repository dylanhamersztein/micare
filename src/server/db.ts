import { Pool } from 'pg'
import type { QueryResult, QueryResultRow } from 'pg'

import { env } from '../env.server'

let pool: Pool | undefined

function getPool(): Pool {
  pool ??= new Pool({ connectionString: env.DATABASE_URL })
  return pool
}

export const db = {
  query<T extends QueryResultRow>(
    text: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<QueryResult<T>> {
    return getPool().query<T>(text, params as unknown[])
  },
}
