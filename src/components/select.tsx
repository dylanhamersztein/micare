import { ChevronDown } from 'lucide-react'

import { CONTROL_CLASSES } from './control'
import { useFieldWiring } from './field'

import type { ComponentPropsWithoutRef } from 'react'

export type SelectProps = ComponentPropsWithoutRef<'select'>

export function Select({ className, ...props }: SelectProps) {
  const wiring = useFieldWiring()

  return (
    // The chevron is drawn rather than left to the platform, so the control
    // looks the same on every OS. It sits over the select and lets clicks
    // through, so the whole box still opens the menu.
    <span className="relative block">
      <select
        id={wiring?.controlId}
        aria-describedby={wiring?.describedBy}
        aria-invalid={wiring?.invalid || undefined}
        required={wiring?.required || undefined}
        className={[
          CONTROL_CLASSES,
          'h-12 appearance-none pr-11 text-base',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
      <ChevronDown
        className="pointer-events-none absolute top-3.5 right-3.5 size-5 text-text-body"
        aria-hidden="true"
      />
    </span>
  )
}
