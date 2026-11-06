import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

// T2 acceptance: export menu → options dialog → a real file download whose
// bytes match the format. Needs the backend + live YouTube captions (dev setup).
test("exports SRT and PDF with correct dialog, filenames and contents", async ({ page }) => {
  await page.goto("/transcript?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ");
  const segments = page.locator("main article");
  await expect(segments.first()).toBeVisible({ timeout: 45_000 });

  // Menu lists every format.
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Export transcript" });
  await expect(menu).toBeVisible();
  for (const format of ["TXT", "SRT", "VTT", "MD", "CSV", "DOCX", "PDF"]) {
    await expect(menu.getByRole("menuitem", { name: format })).toBeVisible();
  }

  // SRT download through the options dialog.
  await menu.getByRole("menuitem", { name: "SRT" }).click();
  const dialog = page.getByRole("dialog", { name: "Export options" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(".srt", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Entire transcript")).toBeVisible();
  const [srt] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  expect(srt.suggestedFilename()).toMatch(/\.srt$/);
  expect(srt.suggestedFilename()).not.toMatch(/[\\/]/);
  const srtText = readFileSync(await srt.path(), "utf8");
  expect(srtText).toMatch(/\d+\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/);
  expect(srtText.trim().split("\n\n").length).toBeGreaterThan(10);
  await expect(page.getByRole("status")).toContainText("Downloaded");

  // PDF download — binary path, includes the embedded Unicode font (ADR-013).
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("menu", { name: "Export transcript" }).getByRole("menuitem", { name: "PDF" }).click();
  const pdfDialog = page.getByRole("dialog", { name: "Export options" });
  await expect(pdfDialog.getByText(".pdf", { exact: true })).toBeVisible();
  const [pdf] = await Promise.all([
    page.waitForEvent("download"),
    pdfDialog.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  const bytes = readFileSync(await pdf.path());
  const latin1 = bytes.toString("latin1");
  expect(latin1.startsWith("%PDF-")).toBe(true);
  expect(latin1).toContain("FontFile2");
  expect(latin1).toContain("%%EOF");
});
