import type { ReactNode } from 'react'

// One tile of a dashboard's readout: a caps label, one thing the tile reports,
// and at most one line of context under it. Rendered as a description-list
// entry, because that is what it is — a term and its definition.
//
// Two rules from the design hold it together. Never two figures in one tile:
// the caps label names one thing, so the tile reports one thing. And figures
// are never coloured for sentiment — no green "up", no red "down". A directory
// does not editorialise its own numbers, and a Practitioner who had a quiet
// month does not need a red number to tell them.

export type StatusReadoutProps = {
  label: string
  /**
   * The one figure this tile reports, already formatted. Takes precedence over
   * `children`: a tile reports a figure or a state, never both.
   */
  figure?: ReactNode
  /** The state this tile reports, when it reports a state rather than a figure. */
  children?: ReactNode
  /** At most one line, under the thing it is about. */
  context?: ReactNode
  /**
   * The sand ground: reserved for the one tile that justifies the
   * subscription. Everything beside it stays on white and stays quieter.
   */
  emphasis?: boolean
}

export function StatusReadout({
  label,
  figure,
  children,
  context,
  emphasis = false,
}: StatusReadoutProps) {
  const reportsFigure = figure !== undefined

  return (
    <div
      className={`rounded-md border border-border p-5.5 ${
        emphasis ? 'bg-surface-sand' : 'bg-surface-raised'
      }`}
    >
      <dt
        className={`text-label font-bold tracking-caps uppercase ${
          emphasis ? 'text-text-body' : 'text-text-muted'
        }`}
      >
        {label}
      </dt>
      <dd>
        {reportsFigure ? (
          <p className="mt-2.5 text-figure font-bold tracking-tightest tabular-nums">
            {figure}
          </p>
        ) : (
          <div className="mt-3 flex items-center gap-2.5">{children}</div>
        )}
        {context !== undefined && (
          <p
            className={`mt-1.5 text-meta tabular-nums ${
              emphasis ? 'text-text-body' : 'text-text-muted'
            }`}
          >
            {context}
          </p>
        )}
      </dd>
    </div>
  )
}
