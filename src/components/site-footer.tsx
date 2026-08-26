import { Link } from '@tanstack/react-router'

import { Wordmark } from './wordmark'

// The footer every page ends on. This is where the site states its own terms
// of trade: "nothing here is a paid placement" is not a marketing line for the
// homepage, it is the promise the directory is built on, so it sits on every
// page permanently.
//
// On a narrow screen the link columns become 48px rows separated by hairlines
// — a list you can hit, rather than a column of underlined text — and the
// Practitioner offer is promoted above them, because the mobile header does
// not carry it.

/**
 * A legal page, as a bare href rather than a typed route: the privacy policy
 * and terms arrive with #46, and until their routes exist the router has no
 * path to typecheck against. The slot is here so that work is a list, not a
 * layout change.
 */
export type LegalLink = { label: string; href: string }

const COLUMN_HEADING_CLASSES =
  'text-label font-bold tracking-caps text-text-invert-muted uppercase'

/** A 48px row on mobile, a 44px link in a column above it. */
const FOOTER_LINK_CLASSES =
  'flex min-h-12 items-center border-b border-hairline-invert text-base text-text-invert last:border-b-0 hover:underline sm:min-h-(--touch-min) sm:border-0'

/** The one offer, a full-width plate on mobile and a plain link above it. */
const OFFER_CLASSES =
  'flex min-h-13 items-center justify-center rounded-sm bg-surface-sunk px-4 text-base font-bold text-surface-deep sm:min-h-(--touch-min) sm:justify-start sm:rounded-none sm:bg-transparent sm:px-0 sm:font-normal sm:text-text-invert sm:hover:underline'

export type SiteFooterProps = {
  /** The legal pages, once there are any. */
  legalLinks?: ReadonlyArray<LegalLink>
}

export function SiteFooter({ legalLinks = [] }: SiteFooterProps) {
  return (
    <footer
      className="on-deep mt-auto bg-surface-deep text-text-invert"
      data-testid="site-footer"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between md:gap-12">
          <div className="md:max-w-[32ch]">
            <Wordmark />
            <p className="mt-3.5 text-meta text-text-invert-muted">
              A directory of independent healthcare Practitioners, checked
              against their statutory regulator every week.
            </p>
          </div>

          <div className="flex flex-col gap-8 sm:flex-row sm:gap-12">
            <nav aria-label="Find care">
              <div className={COLUMN_HEADING_CLASSES}>Find care</div>
              <div className="mt-3.5 flex flex-col">
                <Link
                  to="/search"
                  className={FOOTER_LINK_CLASSES}
                  data-testid="footer-search"
                >
                  Find an optician
                </Link>
              </div>
            </nav>

            {/* First on a narrow screen: this is the only place the offer
                appears there. */}
            <nav
              aria-label="For Practitioners"
              className="order-first sm:order-none"
            >
              <div className={COLUMN_HEADING_CLASSES}>For Practitioners</div>
              <div className="mt-3.5 flex flex-col">
                <Link
                  to="/signup"
                  className={OFFER_CLASSES}
                  data-testid="footer-signup"
                >
                  List your Practice — £29/month
                </Link>
                <Link
                  to="/login"
                  className={FOOTER_LINK_CLASSES}
                  data-testid="footer-signin"
                >
                  Sign in
                </Link>
              </div>
            </nav>

            {legalLinks.length > 0 && (
              <nav aria-label="MiCare" data-testid="footer-legal">
                <div className={COLUMN_HEADING_CLASSES}>MiCare</div>
                <div className="mt-3.5 flex flex-col">
                  {legalLinks.map(({ label, href }) => (
                    <a key={href} href={href} className={FOOTER_LINK_CLASSES}>
                      {label}
                    </a>
                  ))}
                </div>
              </nav>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-hairline-invert pt-6 sm:mt-10">
          <span className="text-meta text-text-invert-muted">
            © {new Date().getFullYear()} MiCare Ltd · Registered in England and
            Wales 15482910
          </span>
          <span className="text-meta font-semibold sm:ml-auto">
            Nothing on MiCare is a paid placement. Results are ordered by
            distance.
          </span>
        </div>
      </div>
    </footer>
  )
}
