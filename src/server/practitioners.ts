import { createServerFn } from '@tanstack/react-start'

import { db } from './db'

export type VisiblePractitioner = {
  id: string
  short_id: string
  full_name: string
  practice_town: string | null
}

export const getVisiblePractitioners = createServerFn({
  method: 'GET',
}).handler(async (): Promise<Array<VisiblePractitioner>> => {
  const result = await db.query<VisiblePractitioner>(
    `select id, short_id, full_name, practice_town
         from public.practitioners
         where visible = true
         order by full_name asc`,
  )
  return result.rows
})
