import { expect, test } from "@playwright/test";

test("homepage renders the URL form and validates input", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /youtube transcript generator/i }),
  ).toBeVisible();

  // Invalid URL stays client-side and shows the alert. Two forms share the
  // label (hero + closing CTA) — target the hero field by id.
  await page.locator("#youtube-url").fill("not a youtube url");
  await page
    .locator("form:has(#youtube-url)")
    .getByRole("button", { name: "Generate Transcript" })
    .click();
  // Next's route announcer is also role="alert" — scope to the field error.
  await expect(page.locator("#youtube-url-error")).toHaveText(
    "That doesn't look like a supported YouTube video URL.",
  );
  expect(page.url()).toBe("http://localhost:3000/");
});

test("nav exposes Library and Batch", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Library" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Batch" })).toBeVisible();
});

test("library and batch pages render their empty states", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Library", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import file" })).toBeVisible();

  await page.goto("/batch");
  await expect(page.getByRole("heading", { name: "Batch", level: 1 })).toBeVisible();
  await expect(page.getByPlaceholder(/youtube\.com\/watch/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Run batch (0)" })).toBeDisabled();
});
