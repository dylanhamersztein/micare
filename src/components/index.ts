// Shared presentational components. Hand-built on native HTML elements — no
// component library — and reachable as `#/components`.

export { Alert } from './alert'
export type { AlertProps, AlertTone } from './alert'

export { Button, buttonClasses } from './button'
export type { ButtonProps, ButtonSize, ButtonVariant } from './button'

export { Checkbox } from './checkbox'
export type { CheckboxProps } from './checkbox'

export { Field, useFieldWiring } from './field'
export type { FieldProps, FieldRequirement, FieldWiring } from './field'

export { withUnbrokenFigures } from './figures'

export { FileUpload } from './file-upload'
export type { FileUploadProps } from './file-upload'

export { STANDALONE_LINK_CLASSES, TEXT_LINK_CLASSES } from './link'

export { NoticePage } from './notice-page'
export type { NoticePageProps, NoticeTone } from './notice-page'

export { PractitionerResultCard } from './practitioner-result-card'
export type { PractitionerResultCardProps } from './practitioner-result-card'

export { SegmentedRadio } from './segmented-radio'
export type {
  SegmentedRadioOption,
  SegmentedRadioProps,
} from './segmented-radio'

export { Select } from './select'
export type { SelectProps } from './select'

export { SignupOutcome } from './signup-outcome'
export type { SignupOutcomeProps } from './signup-outcome'

export { SiteFooter } from './site-footer'
export type { LegalLink, SiteFooterProps } from './site-footer'

export { SiteHeader } from './site-header'
export type { SiteHeaderProps } from './site-header'

export { StatusReadout } from './status-readout'
export type { StatusReadoutProps } from './status-readout'

export { SubscriptionBadge } from './subscription-badge'
export type { SubscriptionBadgeProps } from './subscription-badge'

export { TextInput } from './text-input'
export type { TextInputProps, TextInputSize } from './text-input'

export { Textarea } from './textarea'
export type { TextareaProps } from './textarea'

export { VerificationBadge } from './verification-badge'
export type {
  VerificationBadgeProps,
  VerificationBadgeVariant,
} from './verification-badge'

export { VerificationWait } from './verification-wait'
export type { VerificationWaitProps } from './verification-wait'

export { Wordmark } from './wordmark'
