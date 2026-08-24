// The chrome every form control shares: a 3.4:1 outline (SC 1.4.11), the
// error tone, and the disabled palette. The border thickens on focus as well
// as taking the ring from the base layer, so focus survives greyscale and
// Windows high-contrast mode.
export const CONTROL_CLASSES =
  'w-full rounded-sm border border-border-strong bg-surface-raised px-3.5 text-text ' +
  'focus-visible:border-2 focus-visible:border-primary ' +
  'aria-invalid:border-2 aria-invalid:border-rejected ' +
  'disabled:border-disabled-border disabled:bg-surface-sunk disabled:text-text-subtle'
