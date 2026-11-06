import { expect, test } from "@playwright/test";

// Core product flow: URL → backend extraction → rendered transcript.
// Requires the backend and live YouTube caption access (both in the dev setup).
test("extracts and renders a real transcript", async ({ page }) => {
  await page.goto("/");
  // Two forms share the label (hero + closing CTA) — target the hero field by id.
  await page
    .locator("#youtube-url")
    .fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page
    .locator("form:has(#youtube-url)")
    .getByRole("button", { name: "Generate Transcript" })
    .click();

  await expect(page).toHaveURL(/\/transcript\?url=/);
  const segments = page.locator("main article");
  await expect(segments.first()).toBeVisible({ timeout: 45_000 });
  expect(await segments.count()).toBeGreaterThan(10);

  // Workspace controls from every tranche are present.
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
  await expect(page.getByRole("button", { name: "★ Save" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare" })).toBeVisible();
});

test("saved transcript loads from the local library without the backend", async ({ page }) => {
  // Save first (IndexedDB is per-browser-context, so save and reload in one test).
  await page.goto("/transcript?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ");
  const segments = page.locator("main article");
  await expect(segments.first()).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "★ Save" }).click();
  await expect(page.getByRole("status")).toContainText("Saved to your library");

  await page.goto("/library");
  // Saved section renders first; its rows link to /transcript?saved=<id>.
  const openLink = page.locator('a[href*="?saved="]').first();
  await expect(openLink).toBeVisible();
  await openLink.click();

  await expect(page).toHaveURL(/\/transcript\?saved=/);
  await expect(segments.first()).toBeVisible({ timeout: 15_000 });
  // Saved transcripts carry a fixed language — the language picker is hidden.
  await expect(page.getByLabel("Language")).toHaveCount(0);
});
