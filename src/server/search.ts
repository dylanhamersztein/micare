// `search` server function — thin createServerFn wrapper around the
// `searchPractitioners` deep module. Routes import this; tests import
// `searchPractitioners` from `./search-impl` directly so they exercise the
// real code path without bouncing through TanStack's RPC layer.

import { createServerFn } from '@tanstack/react-start'

import { searchInputSchema } from '../search-input'
import { searchPractitioners } from './search-impl'

export const search = createServerFn({ method: 'GET' })
  .inputValidator((raw: unknown) => searchInputSchema.parse(raw))
  .handler(({ data }) => searchPractitioners(data))
