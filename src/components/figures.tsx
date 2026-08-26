import type { ReactNode } from 'react'

// A registration number offers the browser a break opportunity at its hyphen,
// so `01-31842` wraps as `01-` / `31842` at exactly the measure the signup
// form uses. An example of a format, broken across two lines, teaches the
// wrong format — and the field that shows it is the field where the format is
// the whole point. The copy stays one string with one home
// (src/goc-number.ts); only its rendering is taught not to break.

/** A registration number: two digits or a one-to-two letter code, then digits. */
const FIGURE = /(\b[0-9A-Z]{1,2}-\d+\b)/g

/** The same copy, with every registration number in it held on one line. */
export function withUnbrokenFigures(copy: string): ReactNode {
  return copy.split(FIGURE).map((part, index) =>
    // Odd indices are the captured figures; even ones are the words between.
    index % 2 === 0 ? (
      part
    ) : (
      <span key={`${part}-${index}`} className="whitespace-nowrap">
        {part}
      </span>
    ),
  )
}
