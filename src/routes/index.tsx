import { createFileRoute } from "@tanstack/react-router";

import { getVisiblePractitioners } from "../server/practitioners";

export const Route = createFileRoute("/")({
  loader: () => getVisiblePractitioners(),
  component: Home,
});

function Home() {
  const practitioners = Route.useLoaderData();

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">MiCare</h1>
      <p className="mt-4 text-lg" data-testid="practitioner-count">
        {practitioners.length} verified practitioner
        {practitioners.length === 1 ? "" : "s"} listed
      </p>
      <ul className="mt-4 space-y-1">
        {practitioners.map((p) => (
          <li key={p.id} data-testid={`practitioner-${p.short_id}`}>
            {p.full_name}
            {p.practice_town ? ` — ${p.practice_town}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
