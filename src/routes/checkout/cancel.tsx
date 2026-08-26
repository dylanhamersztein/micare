import { Link, createFileRoute } from '@tanstack/react-router'

import { buttonClasses, NoticePage } from '#/components'

export const Route = createFileRoute('/checkout/cancel')({
  component: CheckoutCancelPage,
})

function CheckoutCancelPage() {
  return (
    <NoticePage
      tone="problem"
      eyebrow="Payment cancelled"
      title="Nothing has been charged"
      data-testid="checkout-cancel"
    >
      <p>
        You left the payment step before it finished, so no subscription has
        started and your card has not been charged. Your registration check
        still stands — you can pick up where you left off whenever you like.
      </p>
      <p>
        <Link to="/signup" className={buttonClasses({ size: 'lg' })}>
          Back to signup
        </Link>
      </p>
    </NoticePage>
  )
}
