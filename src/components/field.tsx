import { TriangleAlert } from 'lucide-react'
import { createContext, useContext, useId } from 'react'

import type { ReactNode } from 'react'

// One anatomy for every field: caps label above, help text under the label
// (not under the input, where it gets skipped), the control, and error text
// that replaces nothing — it is added beneath and chained onto the control's
// description. Required is stated in words; a 60-year-old filling this in on a
// bus should never have to hunt for a legend explaining a symbol.

export type FieldRequirement = 'required' | 'optional'

/**
 * What a Field tells the control inside it. `TextInput`, `Textarea` and
 * `Select` read this instead of each caller re-deriving ids and re-chaining
 * `aria-describedby` by hand — the mistake the retrofitted screens all made.
 */
export type FieldWiring = {
  controlId: string
  describedBy: string | undefined
  invalid: boolean
  required: boolean
}

const FieldContext = createContext<FieldWiring | null>(null)

/** The wiring from the enclosing Field, or nothing when used standalone. */
export function useFieldWiring(): FieldWiring | null {
  return useContext(FieldContext)
}

export type FieldProps = {
  label: string
  help?: ReactNode
  requirement?: FieldRequirement
  error?: ReactNode
  children: ReactNode
}

function isPresent(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== ''
}

const REQUIREMENT_WORD: Readonly<Record<FieldRequirement, string>> = {
  required: 'Required',
  optional: 'Optional',
}

export function Field({
  label,
  help,
  requirement,
  error,
  children,
}: FieldProps) {
  // A server function reports a clean field as `null`, not `undefined`, and a
  // conditional renders `false`. Neither is content.
  const hasHelp = isPresent(help)
  const hasError = isPresent(error)
  const id = useId()
  const controlId = `${id}-control`
  const helpId = `${id}-help`
  const errorId = `${id}-error`

  // Help first, then the error: a screen reader should hear what the field
  // wants before it hears what went wrong.
  const describedBy =
    [hasHelp ? helpId : null, hasError ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <FieldContext.Provider
      value={{
        controlId,
        describedBy,
        invalid: hasError,
        required: requirement === 'required',
      }}
    >
      <div className="flex flex-col">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label
            htmlFor={controlId}
            className="text-label font-bold tracking-caps text-text-body uppercase"
          >
            {label}
          </label>
          {requirement !== undefined && (
            <span className="text-[0.875rem] font-semibold text-text-muted">
              {REQUIREMENT_WORD[requirement]}
            </span>
          )}
        </div>
        {hasHelp && (
          <p id={helpId} className="mb-2 text-meta text-text-muted">
            {help}
          </p>
        )}
        {children}
        {hasError && (
          <p
            id={errorId}
            className="mt-2 flex items-start gap-2 text-meta text-rejected-ink"
          >
            <TriangleAlert
              className="mt-0.5 size-[19px] shrink-0"
              aria-hidden="true"
            />
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}
