import { Link, createFileRoute } from '@tanstack/react-router'

import { buttonClasses, NoticePage } from '#/components'

export const Route = createFileRoute('/checkout/success')({
  component: CheckoutSuccessPage,
})

function CheckoutSuccessPage() {
  return (
    <NoticePage
      tone="affirm"
      eyebrow="Payment received"
      title="Your subscription is starting"
      data-testid="checkout-success"
    >
      <p>
        Thanks — we are activating your £29-a-month subscription now. The next
        step is your profile: your photo, your Practice details and your opening
        hours. Nothing appears in search until you have filled it in.
      </p>
      <p>
        <Link
          to="/practitioner/profile-editor"
          className={buttonClasses({ size: 'lg' })}
        >
          Continue to your profile editor
        </Link>
      </p>
    </NoticePage>
  )
}
