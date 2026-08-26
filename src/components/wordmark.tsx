// MiCare's mark. A weight change, not a logo: one word of Newsreader with the
// break at the syllable — `Mi` at 600 against `Care` at 400. There is no image
// asset and no symbol, which is the point: a company that checks other
// people's credentials should not arrive wearing a swoosh, and a typographic
// mark still reads at 24px on a five-year-old phone at 1× DPI.
//
// 24px is the header lockup and the size the shell sets it at. Colour is not
// set here — the mark inherits it, so the same component serves the cream on
// surface-deep and the ink on paper.
export function Wordmark() {
  return (
    <span className="font-serif text-h2 leading-none tracking-wordmark">
      <span className="font-semibold">Mi</span>
      <span className="font-normal">Care</span>
    </span>
  )
}
