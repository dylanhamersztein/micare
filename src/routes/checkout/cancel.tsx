import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/checkout/cancel')({
  component: CheckoutCancelPage,
})

function CheckoutCancelPage() {
  return (
    <div className="mx-auto max-w-2xl p-8" data-testid="checkout-cancel">
      <h1 className="text-2xl font-bold">Payment cancelled</h1>
      <p className="mt-2 text-gray-700">
        You didn&apos;t finish payment, so we haven&apos;t set up your
        subscription. You can pick up where you left off from the signup page.
      </p>
      <p className="mt-4">
        <Link to="/signup" className="rounded bg-black px-4 py-2 text-white">
          Back to signup
        </Link>
      </p>
    </div>
  )
}
