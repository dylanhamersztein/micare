import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/practitioner/profile-editor')({
  component: ProfileEditorPlaceholder,
})

function ProfileEditorPlaceholder() {
  return (
    <div className="mx-auto max-w-2xl p-8" data-testid="profile-editor">
      <h1 className="text-2xl font-bold">Your profile editor</h1>
      <p className="mt-2 text-gray-700">
        You&apos;re verified and your subscription is active. The full profile
        editor — practice address, services, opening hours, booking link — ships
        next.
      </p>
    </div>
  )
}
