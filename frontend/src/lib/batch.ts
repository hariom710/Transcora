import { ApiFailure, extractTranscript } from "@/services/api";

/** ADR-012: frontend-sequenced batch through the existing extraction
    contract — no backend state, one shared rate budget, partial success. */
export const BATCH_MAX = 20;
const DEFAULT_DELAY_MS = 800;

export interface BatchItem {
  index: number;
  url: string;
  status: "pending" | "ok" | "error";
  videoId?: string;
  error?: string;
}

export interface BatchCallbacks {
  /** Called once per finished item, in submission order. */
  onItem: (item: BatchItem) => void;
  /** Pause between requests; 0 skips the wait (tests). */
  delayMs?: number;
  isCancelled?: () => boolean;
}

/** Splits pasted text into URLs; empties are dropped, order preserved. */
export function extractUrls(input: string): string[] {
  return input
    .split(/[\n\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs urls strictly one at a time; failures become per-item errors and
    never abort the rest (SECURITY.md §O partial-failure rule). */
export async function runBatch(urls: string[], callbacks: BatchCallbacks): Promise<BatchItem[]> {
  if (urls.length > BATCH_MAX) {
    throw new ApiFailure(
      "BATCH_TOO_LARGE",
      `Batches are capped at ${BATCH_MAX} videos — trim your list and run again.`,
    );
  }
  const results: BatchItem[] = [];
  for (let index = 0; index < urls.length; index++) {
    if (callbacks.isCancelled?.()) break;
    const url = urls[index];
    const item: BatchItem = { index, url, status: "pending" };
    try {
      const transcript = await extractTranscript(url);
      item.status = "ok";
      item.videoId = transcript.video_id;
    } catch (cause) {
      item.status = "error";
      item.error =
        cause instanceof ApiFailure ? cause.message : "Something went wrong. Please try again.";
    }
    results.push(item);
    callbacks.onItem(item);
    if (index < urls.length - 1 && callbacks.delayMs !== 0) {
      await sleep(callbacks.delayMs ?? DEFAULT_DELAY_MS);
    }
  }
  return results;
}
