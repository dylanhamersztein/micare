import { Check } from 'lucide-react'
import { useId } from 'react'

import type { ReactNode } from 'react'

// A row of butted-together segments over native radios. The radio is visually
// hidden but still focusable and still the thing a screen reader operates; the
// segment is only its skin.
//
// The ring is the reason for the `relative` on each segment. A visually hidden
// radio is absolutely positioned, so without a positioned ancestor it resolves
// against the page and the focus ring lands somewhere other than the segment
// the user is on. `has-[:focus-visible]` then moves the ring onto the segment,
// and the inset offset keeps it clear of the neighbours pressed against it.

export type SegmentedRadioOption<TValue extends string | number> = {
  value: TValue
  label: ReactNode
}

export type SegmentedRadioProps<TValue extends string | number> = {
  legend: string
  name: string
  options: ReadonlyArray<SegmentedRadioOption<TValue>>
  value: TValue
  onChange: (value: TValue) => void
}

export function SegmentedRadio<TValue extends string | number>({
  legend,
  name,
  options,
  value,
  onChange,
}: SegmentedRadioProps<TValue>) {
  const id = useId()

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2.5 p-0 text-label font-bold tracking-caps text-text-body uppercase">
        {legend}
      </legend>
      <div className="flex overflow-hidden rounded-sm border border-border-strong bg-surface-raised">
        {options.map((option, index) => {
          const selected = option.value === value

          return (
            <label
              key={option.value}
              htmlFor={`${id}-${index}`}
              className={[
                'relative flex flex-1 cursor-pointer items-center justify-center gap-1.5',
                'min-h-(--touch-min) px-3 py-2 text-base font-semibold',
                'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus has-[:focus-visible]:-outline-offset-3',
                index < options.length - 1
                  ? 'border-r border-border-strong'
                  : '',
                selected
                  ? 'bg-primary text-white'
                  : 'bg-surface-raised text-text',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <input
                id={`${id}-${index}`}
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="absolute size-px opacity-0"
              />
              {/* A tick as well as the fill: state is never colour alone. */}
              {selected && <Check className="size-[17px]" aria-hidden="true" />}
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
