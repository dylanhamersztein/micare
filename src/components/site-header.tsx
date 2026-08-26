import { Link } from '@tanstack/react-router'
import { LayoutDashboard, Search } from 'lucide-react'

import { Wordmark } from './wordmark'

// The bar every page sits under. Consumer navigation and Practitioner business
// share it but never share a region: a consumer never has to read past "List
// your Practice" to find search, and a Practitioner never has to read past
// search to find their dashboard.
//
// There is no hamburger. Three consumer destinations, one of which is the page
// you are on, do not earn a gesture — and a 24px icon is the wrong thing to
// put in front of someone who came here because their eyes are not what they
// were. Narrow screens wrap the bar to a second row instead.

const LINK_BASE =
  'inline-flex items-center gap-2 min-h-(--touch-min) whitespace-nowrap'

/** Practitioner business, in cream on the green. */
const CTA_CLASSES = `${LINK_BASE} rounded-sm bg-surface-sunk px-3.5 text-meta font-bold text-surface-deep hover:bg-surface-raised sm:px-4.5`

/** The quieter half of the same pair — outlined rather than filled. */
const OUTLINE_CLASSES = `${LINK_BASE} rounded-sm border-[1.5px] border-outline-invert px-3.5 text-meta font-semibold text-text-invert hover:bg-primary sm:px-4`

export type SiteHeaderProps = {
  /** Whether the request carried a Practitioner session (ADR-0021). */
  signedIn: boolean
}

export function SiteHeader({ signedIn }: SiteHeaderProps) {
  return (
    <header
      className="on-deep sticky top-0 z-30 bg-surface-deep text-text-invert"
      data-testid="site-header"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-0.5 px-4 py-1 sm:h-16 sm:flex-nowrap sm:gap-x-7 sm:px-6 sm:py-0">
        <Link
          to="/"
          className={`${LINK_BASE} flex-none`}
          data-testid="header-home"
        >
          <Wordmark />
        </Link>

        {/* Row two on a narrow screen — the one thing a consumer came for,
            under their thumb rather than behind a menu. */}
        <nav
          aria-label="Find care"
          className="order-last flex w-full flex-none items-center border-t border-hairline-invert sm:order-none sm:w-auto sm:border-0"
        >
          <Link
            to="/search"
            className={`${LINK_BASE} font-semibold`}
            data-testid="header-search"
          >
            <Search
              className="size-[19px] shrink-0"
              strokeWidth={2.1}
              aria-hidden="true"
            />
            Find an optician
          </Link>
        </nav>

        {/* Signed in, the two Practitioner links collapse into the one
            destination they were both heading for. The bar never grows. */}
        <div className="ml-auto flex flex-none items-center gap-2 sm:gap-3">
          {signedIn ? (
            <Link
              to="/dashboard"
              className={CTA_CLASSES}
              data-testid="header-dashboard"
            >
              <LayoutDashboard
                className="size-[18px] shrink-0"
                strokeWidth={2.2}
                aria-hidden="true"
              />
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className={CTA_CLASSES}
                data-testid="header-signup"
              >
                List your Practice
              </Link>
              <Link
                to="/login"
                className={OUTLINE_CLASSES}
                data-testid="header-signin"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
