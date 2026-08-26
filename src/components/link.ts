// The chrome a text link shares, as classes rather than a component: a route
// navigating within MiCare uses TanStack's own `Link`, which takes a className
// but is not an `<a>` we can wrap. Same arrangement as CONTROL_CLASSES.
//
// Underlined as well as coloured, because a coloured word is not a link to a
// reader who cannot see the colour.
export const TEXT_LINK_CLASSES =
  'font-semibold text-primary underline decoration-1 underline-offset-4 hover:text-primary-hover'

/** For a link standing on its own as a page's one way onward — 44px of it. */
export const STANDALONE_LINK_CLASSES = `inline-flex min-h-(--touch-min) items-center gap-2 ${TEXT_LINK_CLASSES}`
