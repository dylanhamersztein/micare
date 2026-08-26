import { UserRound } from 'lucide-react'
import { useId, useState } from 'react'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

// The design's upload zone: the guidance, a dashed area a photo can be dropped
// on, the words that open the picker, and the constraints — stated before the
// upload rather than only in the rejection that follows one.
//
// The control itself is a native file input, hidden but focusable behind those
// words. Hidden means transparent and one pixel, never `display: none`, which
// would take it out of the tab order. And the label it hides inside is
// positioned, because an absolutely positioned input with no positioned
// ancestor resolves against the page — the focus ring then lands somewhere
// other than the control the user is on. Same fix as the segmented control.

export type FileUploadProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'type' | 'onChange'
> & {
  /** What the file is for, as the caps label above the zone. */
  label: string
  /** What the file has to be — said before the picker opens. */
  guidance?: ReactNode
  /** The formats and limits the file has to satisfy. */
  help?: ReactNode
  /** The words that open the picker. */
  choose?: string
  onFile: (file: File) => void
}

export function FileUpload({
  label,
  guidance,
  help,
  choose = 'Choose a photo',
  onFile,
  className,
  disabled,
  ...props
}: FileUploadProps) {
  const id = useId()
  const controlId = `${id}-control`
  const guidanceId = `${id}-guidance`
  const helpId = `${id}-help`
  const [over, setOver] = useState(false)

  const describedBy =
    [
      guidance === undefined ? null : guidanceId,
      help === undefined ? null : helpId,
    ]
      .filter(Boolean)
      .join(' ') || undefined

  function take(file: File | undefined) {
    if (file !== undefined) onFile(file)
  }

  return (
    <div
      onDragOver={(event) => {
        if (disabled) return
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        if (disabled) return
        take(event.dataTransfer.files[0])
      }}
    >
      <label
        htmlFor={controlId}
        className="text-label font-bold tracking-caps text-text-body uppercase"
      >
        {label}
      </label>
      {guidance !== undefined && (
        <p id={guidanceId} className="mt-1.5 text-meta text-text-muted">
          {guidance}
        </p>
      )}
      <div
        className={`mt-2.5 rounded-md border-2 border-dashed p-6 text-center ${
          over
            ? 'border-primary bg-primary-soft'
            : 'border-border-strong bg-surface-raised'
        }`}
      >
        <UserRound
          className="mx-auto size-6.5 text-text-muted"
          aria-hidden="true"
        />
        <p className="mt-2.5 text-base text-text-body">
          Drag your photo here, or
        </p>
        <label
          htmlFor={controlId}
          className="relative mt-3 inline-flex min-h-(--touch-min) cursor-pointer items-center rounded-sm border-2 border-primary px-5 text-base font-semibold text-primary hover:bg-primary-soft"
        >
          {choose}
          <input
            id={controlId}
            type="file"
            disabled={disabled}
            aria-describedby={describedBy}
            // Cleared on every pick, so choosing the same file again after a
            // rejection still fires a change event.
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              take(file)
            }}
            className={['absolute size-px opacity-0', className]
              .filter(Boolean)
              .join(' ')}
            {...props}
          />
        </label>
        {help !== undefined && (
          <p id={helpId} className="mt-3.5 text-meta text-text-muted">
            {help}
          </p>
        )}
      </div>
    </div>
  )
}
