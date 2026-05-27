import { expect, test } from "@playwright/test";

test("shows the checkpoint 0 bootstrap page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "FairGame Rebuild" })).toBeVisible();
  await expect(page.getByText("Checkpoint 0")).toBeVisible();
  await expect(page.getByText("Board A")).toBeVisible();
  await expect(page.getByText("seat1 starts")).toBeVisible();
  await expect(page.getByText("Board B")).toBeVisible();
  await expect(page.getByText("seat2 starts")).toBeVisible();
});
