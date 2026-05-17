import { expect, test } from "@playwright/test";

test("homepage lists the seeded visible practitioner", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "MiCare" })).toBeVisible();

  // The visible seed fixture (Jane Smith, London) is the canonical smoke
  // assertion: a server function round-tripped to the seeded DB and the
  // result reached the rendered HTML.
  await expect(page.getByText("Jane Smith")).toBeVisible();
  await expect(page.getByText("London")).toBeVisible();

  // The hidden seed fixture must not leak through visible-only filters.
  await expect(page.getByText("John Doe")).toHaveCount(0);
});
