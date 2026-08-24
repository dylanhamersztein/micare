import { LoaderCircle } from 'lucide-react'

import type { ComponentPropsWithoutRef } from 'react'

// Four intents and three heights. The design's button plate pairs each intent
// with one background and one label colour; every size clears the 44px touch
// floor, and `min-h-(--touch-min)` holds that floor even where a caller's own
// class overrides the height.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary:
    'border-2 border-transparent bg-primary text-white hover:bg-primary-hover',
  secondary:
    'border-2 border-primary bg-surface-raised text-primary hover:bg-primary-soft',
  // Underlined, because a bare coloured word is not a button to everyone.
  ghost:
    'border-2 border-transparent bg-transparent text-primary underline decoration-1 underline-offset-4 hover:bg-primary-soft',
  destructive:
    'border-2 border-transparent bg-rejected text-white hover:bg-rejected-ink',
}

const SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-11 px-4.5 text-meta',
  md: 'h-12 px-5.5 text-base',
  lg: 'h-14 px-6.5 text-lg',
}

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-sm font-semibold min-h-(--touch-min) cursor-pointer'

const DISABLED_CLASSES =
  'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled disabled:text-disabled-ink disabled:no-underline'

/**
 * The chrome a button wears, as classes. Exported because one thing on the
 * site is a primary button and cannot be a `<button>`: the profile's "Book an
 * appointment" leaves for the Practitioner's own site through /go, so it has
 * to be an anchor the browser navigates. It wears this rather than a
 * hand-typed copy of it.
 */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
}: {
  variant?: ButtonVariant
  size?: ButtonSize
} = {}): string {
  return [BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size]].join(' ')
}

export type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Disables the button, marks it busy and shows a spinner. */
  loading?: boolean
  /** What the button is busy doing — replaces the resting label while loading. */
  loadingLabel?: string
}

export function Button({
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      // A busy button is not a button you can press again. Disabling it is the
      // guard; aria-busy is what tells a screen reader why.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        buttonClasses({ variant, size }),
        DISABLED_CLASSES,
        loading ? 'cursor-progress' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading && (
        <LoaderCircle
          className="size-[19px] shrink-0 animate-spin"
          aria-hidden="true"
        />
      )}
      {loading && loadingLabel !== undefined ? loadingLabel : children}
    </button>
  )
}
