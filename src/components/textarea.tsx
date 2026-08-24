import { CONTROL_CLASSES } from './control'
import { useFieldWiring } from './field'

import type { ComponentPropsWithoutRef } from 'react'

export type TextareaProps = ComponentPropsWithoutRef<'textarea'>

export function Textarea({ rows = 4, className, ...props }: TextareaProps) {
  const wiring = useFieldWiring()

  return (
    <textarea
      rows={rows}
      id={wiring?.controlId}
      aria-describedby={wiring?.describedBy}
      aria-invalid={wiring?.invalid || undefined}
      required={wiring?.required || undefined}
      // Vertical only: a horizontally resizable textarea can be dragged out of
      // the column it sits in.
      className={[
        CONTROL_CLASSES,
        'min-h-(--touch-min) resize-y py-3 text-base',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}
