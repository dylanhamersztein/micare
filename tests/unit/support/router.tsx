// A router to render shell components inside. TanStack's `Link` builds its
// href from the router that owns it and throws without one, so a component
// carrying the site's navigation cannot be rendered bare. This is the smallest
// router that makes those links real: the paths the shell points at, and
// nothing behind them.

import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'

import type { RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'

/** Every destination the header and footer link to. */
const SHELL_PATHS = ['/', '/search', '/signup', '/login', '/dashboard'] as const

/** Renders `ui` inside a memory router sitting on `/`. */
export async function renderWithRouter(ui: ReactNode): Promise<RenderResult> {
  const rootRoute = createRootRoute({ component: () => ui })

  const routeTree = rootRoute.addChildren(
    SHELL_PATHS.map((path) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: () => null,
      }),
    ),
  )

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  await router.load()

  return render(<RouterProvider router={router} />)
}
