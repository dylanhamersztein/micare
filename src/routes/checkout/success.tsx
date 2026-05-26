import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/checkout/success')({
  component: CheckoutSuccessPage,
})

function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-2xl p-8" data-testid="checkout-success">
      <h1 className="text-2xl font-bold">Payment received</h1>
      <p className="mt-2 text-gray-700">
        Thanks — your subscription is being activated. Your profile editor will
        be ready in a moment.
      </p>
      <p className="mt-4">
        <Link
          to="/practitioner/profile-editor"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Continue to your profile editor
        </Link>
      </p>
    </div>
  )
}
