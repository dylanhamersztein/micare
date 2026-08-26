import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { SiteFooter, SiteHeader } from '#/components'
import { readShellSession } from '../server/shell-session'
import { SITE_DESCRIPTION, SITE_TITLE } from '../shell-metadata'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  // Every page sits inside a header that has to know who is looking at it, so
  // the session is read here rather than in one route's loader (ADR-0021).
  loader: () => readShellSession(),
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: SITE_TITLE,
      },
      {
        name: 'description',
        content: SITE_DESCRIPTION,
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: RootLayout,
  shellComponent: RootDocument,
})

function RootLayout() {
  const { signedIn } = Route.useLoaderData()

  // A column the full height of the viewport, so the footer sits at the bottom
  // of a short page rather than halfway up it.
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader signedIn={signedIn} />
      <Outlet />
      <SiteFooter />
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {/* Left unwrapped deliberately. @tanstack/devtools-vite deletes this
            element — and the two imports above — from a production build; put
            it behind a condition and the plugin leaves the empty conditional
            behind and the build stops parsing. The guard is the plugin. */}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
