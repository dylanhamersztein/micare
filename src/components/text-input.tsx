import { CONTROL_CLASSES } from './control'
import { useFieldWiring } from './field'

import type { ComponentPropsWithoutRef } from 'react'

// Two heights: 48px everywhere, and one 56px search field. The search box is
// the primary consumer target and sits under a thumb, so it is the only
// control that gets to be taller than the rest of the form.
export type TextInputSize = 'default' | 'search'

const SIZE_CLASSES: Readonly<Record<TextInputSize, string>> = {
  default: 'h-12 text-base',
  search: 'h-14 text-lg',
}

export type TextInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'size'> & {
  size?: TextInputSize
}

export function TextInput({
  size = 'default',
  className,
  ...props
}: TextInputProps) {
  const wiring = useFieldWiring()

  return (
    <input
      type="text"
      id={wiring?.controlId}
      aria-describedby={wiring?.describedBy}
      aria-invalid={wiring?.invalid || undefined}
      required={wiring?.required || undefined}
      className={[CONTROL_CLASSES, SIZE_CLASSES[size], className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}
