import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

// T3 acceptance: editing, statistics, undo/redo, find-and-replace, filler/
// cleanup tools, segment annotations, navigation, reading mode and the
// loading/empty/error states — in a real browser, not just unit tests.
// Live-caption tests share one video to stay under YouTube's rate limit.

const VIDEO_URL = "/transcript?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ";
/** Saved entries double as the player id, so fixtures use a real video id. */
const SAVED_ID = "dQw4w9WgXcQ";

/** The edit every flow works from: fillers + double spaces exercise both tools. */
const EDIT_TEXT = "Um, yeah, so this is  an  edited line, um, ok.";

function statsOf(text: string) {
  const match = text.match(/(\d+) segments · (\d+) words · (\d+) characters/);
  if (!match) throw new Error(`Unexpected stats line: ${text}`);
  return { segments: Number(match[1]), words: Number(match[2]), characters: Number(match[3]) };
}

const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

async function openTranscript(page: Page) {
  await page.goto(VIDEO_URL);
  const segments = page.locator("main article");
  await expect(segments.first()).toBeVisible({ timeout: 45_000 });
  return segments;
}

/** Seeds the browser-local library (IndexedDB) — no backend or YouTube needed. */
async function seedLibrary(page: Page, id: string, segmentsCount: number) {
  await page.goto("/");
  await page.evaluate(
    async ({ id, segmentsCount }) => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const request = indexedDB.open("transcora-library", 1);
        request.onupgradeneeded = () => {
          const store = request.result;
          if (!store.objectStoreNames.contains("saved")) store.createObjectStore("saved", { keyPath: "id" });
          if (!store.objectStoreNames.contains("recent")) store.createObjectStore("recent", { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const segments = Array.from({ length: segmentsCount }, (_, index) => ({
        id: index + 1,
        start: index * 4,
        duration: 4,
        text: `Fixture segment ${index + 1}: never gonna give you up.`,
      }));
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("saved", "readwrite");
        tx.objectStore("saved").put({
          id,
          title: `Fixture ${id}`,
          channel: null,
          thumbnail_url: null,
          language: "English",
          saved_at: Date.now(),
          transcript: {
            video_id: id,
            language: "English",
            language_code: "en",
            is_generated: false,
            segments,
          },
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { id, segmentsCount },
  );
}

test("editing, stats, undo/redo, replace, tools, annotations and navigation", async ({ page }) => {
  test.slow();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const segments = await openTranscript(page);

  const stats = page.locator('p[aria-live="polite"]');
  const first = segments.first();
  const second = segments.nth(1);
  const text = first.locator("p").first();
  const undo = page.getByRole("button", { name: "Undo" });
  const redo = page.getByRole("button", { name: "Redo" });
  const counter = page.locator('span[aria-live="polite"]').filter({ hasText: /^\d+\/\d+$/ });
  const status = page.getByRole("status");
  await expect(undo).toBeDisabled();

  // --- Editing updates the transcript and the statistics together. ---
  const before = statsOf(await stats.innerText());
  const original = (await text.textContent()) ?? "";
  await first.getByRole("button", { name: /^Edit segment/ }).click();
  const editor = page.getByRole("textbox", { name: "Edit transcript segment" });
  await editor.fill(EDIT_TEXT);
  await editor.press("Control+Enter");
  await expect(text).toHaveText(EDIT_TEXT);
  const expectedWords = before.words - countWords(original) + countWords(EDIT_TEXT);
  const expectedChars = before.characters - original.length + EDIT_TEXT.length;
  await expect(stats).toContainText(
    `${before.segments} segments · ${expectedWords} words · ${expectedChars} characters`,
  );
  await expect(undo).toBeEnabled();

  // --- Undo/redo: toolbar buttons, then Ctrl+Z and Ctrl+Shift+Z. ---
  await undo.click();
  await expect(text).toHaveText(original);
  await expect(stats).toContainText(`${before.words} words`);
  await redo.click();
  await expect(text).toHaveText(EDIT_TEXT);
  await page.keyboard.press("Control+z");
  await expect(text).toHaveText(original);
  await page.keyboard.press("Control+Shift+z");
  await expect(text).toHaveText(EDIT_TEXT);
  await expect(redo).toBeDisabled();

  // --- Search, match counter and previous/next navigation (incl. D2 wrap). ---
  const search = page.getByLabel("Search transcript");
  await search.fill("never");
  await expect(counter).toBeVisible();
  const [active, total] = (await counter.innerText()).split("/").map(Number);
  expect(total).toBeGreaterThan(0);
  expect(active).toBe(1);
  expect(await page.locator("#transcript-content mark").count()).toBeGreaterThan(0);
  if (total > 1) {
    await page.getByRole("button", { name: "Next match" }).click();
    await expect(counter).toHaveText(`2/${total}`);
    await page.getByRole("button", { name: "Previous match" }).click();
    await expect(counter).toHaveText(`1/${total}`);
  }
  // From the first match, Previous wraps to the last — never a negative index.
  await page.getByRole("button", { name: "Previous match" }).click();
  await expect(counter).toHaveText(`${total}/${total}`);
  await page.getByRole("button", { name: "Next match" }).click();
  await expect(counter).toHaveText(`1/${total}`);

  // --- Find and replace: count, apply, immediate recount, undo restores. ---
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await page.getByLabel("Replace with").fill("always");
  await page.getByRole("button", { name: /^Replace all \(\d+\)$/ }).click();
  await expect(status).toContainText("Replace:");
  await expect(status).toContainText("segments updated");
  await expect(counter).toHaveText("0/0");
  await expect(page.getByRole("button", { name: "Next match" })).toBeDisabled();
  await expect(segments.filter({ hasText: "always" }).first()).toBeVisible();
  await undo.click();
  await expect(counter).toHaveText(`1/${total}`);
  expect(await page.locator("#transcript-content mark").count()).toBeGreaterThan(0);
  await redo.click();
  await expect(counter).toHaveText("0/0");

  // --- Bulk tools: one operation = one undo step each. ---
  await page.getByRole("button", { name: "Remove fillers" }).click();
  await expect(status).toContainText("Remove fillers:");
  await expect(text).toHaveText("yeah, so this is an edited line, ok.");
  await undo.click();
  await expect(text).toHaveText(EDIT_TEXT);

  await page.getByRole("button", { name: "Clean up text" }).click();
  await expect(status).toContainText("Clean up text:");
  await expect(text).toHaveText("Um, yeah, so this is an edited line, um, ok.");
  await undo.click();
  await expect(text).toHaveText(EDIT_TEXT);

  // --- Annotations: highlight + multiline note on segment 1 (D6), ...
  await first.getByRole("button", { name: /^Highlight segment/ }).click();
  await expect(first.getByRole("button", { name: /^Highlight segment/ })).toHaveAttribute("aria-pressed", "true");
  await expect(stats).toContainText("1 highlighted");
  await first.getByRole("button", { name: /^Note for segment/ }).click();
  const note = page.getByRole("textbox", { name: /^Note for segment/ });
  await note.fill("line one\nline two");
  await note.press("Control+Enter");
  const noteText = first.locator("p").filter({ hasText: "line one" });
  await expect(noteText).toBeVisible();
  const noteSpan = first.locator("span.whitespace-pre-wrap");
  await expect(noteSpan).toHaveCount(1);
  expect(await noteSpan.textContent()).toBe("line one\nline two");
  await expect(stats).toContainText("1 notes");

  // --- ... bookmark on segment 2, then bookmark navigation lands on it. ---
  await second.getByRole("button", { name: /^Bookmark segment/ }).click();
  await expect(second.getByRole("button", { name: /^Bookmark segment/ })).toHaveAttribute("aria-pressed", "true");
  await expect(stats).toContainText("★ 1 bookmarked");
  const bookmarkCount = page.locator('span[aria-live="polite"]').filter({ hasText: "★" });
  await expect(bookmarkCount).toHaveText("★ 1");
  await expect(page.getByRole("button", { name: "Previous bookmark" })).toBeEnabled();
  await page.getByRole("button", { name: "Next bookmark" }).click();
  await expect(second).toHaveClass(/bg-primary\/5/);

  // --- Reading mode: "r" toggles it, and never fires while typing. ---
  const readingMode = page.getByRole("button", { name: "Reading mode" });
  const separator = page.getByRole("separator", { name: "Resize video and transcript panes" });
  await expect(separator).toHaveCount(1);
  await search.click();
  await page.keyboard.press("r");
  await expect(readingMode).toHaveAttribute("aria-pressed", "false"); // typing guard
  await search.fill("");
  await search.evaluate((el: HTMLInputElement) => el.blur());
  await page.keyboard.press("r");
  await expect(readingMode).toHaveAttribute("aria-pressed", "true");
  await expect(separator).toHaveCount(0);
  await page.keyboard.press("r");
  await expect(readingMode).toHaveAttribute("aria-pressed", "false");
  await expect(separator).toHaveCount(1);

  // --- Undo still works after reading mode: the replace step reverts. ---
  await expect(segments.filter({ hasText: "always" }).first()).toBeVisible();
  await undo.click();
  await expect(segments.filter({ hasText: "always" })).toHaveCount(0);
  await expect(segments.filter({ hasText: "never" }).first()).toBeVisible();

  // --- Exports use the edited transcript. ---
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("menu", { name: "Export transcript" }).getByRole("menuitem", { name: "TXT" }).click();
  const dialog = page.getByRole("dialog", { name: "Export options" });
  await expect(dialog).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  const txt = readFileSync(await download.path(), "utf8");
  expect(txt).toContain("edited line");
  expect(txt).not.toContain("always gonna");

  expect(pageErrors).toEqual([]);
});

test("loading and error states render while the transcript request is pending or fails", async ({ page }) => {
  // Delay then abort the transcript call: proves the loading skeleton first,
  // then the error card — without spending a live YouTube caption request.
  await page.route("**/api/v1/transcripts*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.abort("failed");
  });
  await page.goto(VIDEO_URL);
  await expect(page.locator('div[aria-busy="true"]')).toBeVisible();
  await expect(page.getByText("Fetching transcript…")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Transcript unavailable" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  // Malformed URL: rejected before any network call.
  await page.goto("/transcript?url=hello");
  await expect(page.getByRole("alert").filter({ hasText: "supported YouTube video URL" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Go back" })).toBeVisible();
});

test("empty saved transcript shows the no-caption state and zero statistics", async ({ page }) => {
  await seedLibrary(page, "EMPTY000001", 0);
  await page.goto("/transcript?saved=EMPTY000001");
  await expect(page.getByText("This video has no caption text available.")).toBeVisible();
  await expect(page.locator('p[aria-live="polite"]')).toContainText("0 segments · 0 words · 0 characters");
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("switching the transcript language resets edits and annotations (D1)", async ({ page }) => {
  const segments = await openTranscript(page);
  const first = segments.first();
  const undo = page.getByRole("button", { name: "Undo" });
  await first.getByRole("button", { name: /^Edit segment/ }).click();
  await page.getByRole("textbox", { name: "Edit transcript segment" }).fill("edited before language switch");
  await page.keyboard.press("Control+Enter");
  await first.getByRole("button", { name: /^Bookmark segment/ }).click();
  await expect(undo).toBeEnabled();

  const language = page.getByLabel("Language");
  const options = language.locator("option");
  // The language list loads best-effort after the transcript renders
  // ("never block the transcript" in transcript/page.tsx), so counting options
  // the instant segments appear races the fetch — wait for it to settle first.
  await options
    .nth(1)
    .waitFor({ state: "attached", timeout: 15_000 })
    .catch(() => undefined);
  test.skip(
    (await options.count()) < 2,
    "No alternative caption language is listed for this video",
  );
  const code = (await options.nth(1).getAttribute("value")) ?? "";
  expect(code).not.toBe("");
  await language.selectOption(code);

  // Wait for the new request to settle. The reset runs on both the success
  // and the failure path, but only a rendered toolbar can prove it — if the
  // reload errored (e.g. YouTube rate limit), retry once before asserting.
  const settled = page.locator("main article").first().or(page.getByRole("heading", { name: "Transcript unavailable" }));
  await expect(settled).toBeVisible({ timeout: 60_000 });
  if ((await page.getByRole("button", { name: "Try again" }).count()) > 0) {
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator("main article").first()).toBeVisible({ timeout: 60_000 });
  }
  await expect(undo).toBeDisabled();
  await expect(page.locator('span[aria-live="polite"]').filter({ hasText: "★" })).toHaveText("★ 0");
});

test.describe("responsive layout and themes", () => {
  for (const viewport of [
    { name: "mobile", width: 375, height: 812, minTouch: 40 },
    { name: "tablet", width: 768, height: 1024, minTouch: 24 },
    { name: "desktop", width: 1280, height: 720, minTouch: 24 },
  ]) {
    test(`no horizontal overflow and tools reachable at ${viewport.name}`, async ({ page }) => {
      await seedLibrary(page, SAVED_ID, 6);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/transcript?saved=${SAVED_ID}`);
      await expect(page.locator("main article").first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.getByRole("group", { name: "Transcript tools" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
      const editBox = await page
        .locator("main article")
        .first()
        .getByRole("button", { name: /^Edit segment/ })
        .boundingBox();
      expect(editBox?.height ?? 0).toBeGreaterThanOrEqual(viewport.minTouch);
    });
  }

  test("light and dark themes render the transcript without console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await seedLibrary(page, SAVED_ID, 6);
    await page.addInitScript(() => localStorage.setItem("transcora-theme", "light"));
    await page.goto(`/transcript?saved=${SAVED_ID}`);
    await expect(page.locator("main article").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false);

    await page.addInitScript(() => localStorage.setItem("transcora-theme", "dark"));
    await page.reload();
    await expect(page.locator("main article").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);

    // Keyboard: "/" focuses the search field from anywhere.
    await page.keyboard.press("/");
    await expect(page.getByLabel("Search transcript")).toBeFocused();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
