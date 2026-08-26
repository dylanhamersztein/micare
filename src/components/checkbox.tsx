import { useId } from 'react'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

// A 24px box in a 44px row, where the whole row is the label and the whole row
// is the hit target. Not a Field: a checkbox states its own label beside
// itself, so putting a caps label above it would name the same thing twice.
//
// Help sits outside the label rather than inside it. Inside, it would be read
// as part of the control's name — "Accepting new patients Shown on your
// listing turn it off when you are full" — so it is described, not named.

export type CheckboxProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  label: ReactNode
  help?: ReactNode
}

export function Checkbox({ label, help, className, ...props }: CheckboxProps) {
  const id = useId()
  const helpId = `${id}-help`

  return (
    <div className="flex flex-col">
      <label className="flex min-h-(--touch-min) cursor-pointer items-center gap-3 text-base">
        <input
          type="checkbox"
          aria-describedby={help === undefined ? undefined : helpId}
          className={['size-6 shrink-0 accent-primary', className]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        <span>{label}</span>
      </label>
      {help !== undefined && (
        <p id={helpId} className="ml-9 text-meta text-text-muted">
          {help}
        </p>
      )}
    </div>
  )
}
