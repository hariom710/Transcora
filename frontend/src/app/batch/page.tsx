"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BATCH_MAX, extractUrls, runBatch, type BatchItem } from "@/lib/batch";
import { ApiFailure } from "@/services/api";

export default function BatchPage() {
  const [input, setInput] = useState("");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const cancelledRef = useRef(false);

  const urls = extractUrls(input);

  async function handleRun() {
    if (urls.length === 0 || running) return;
    if (urls.length > BATCH_MAX) {
      setError(`Batches are capped at ${BATCH_MAX} videos — trim your list and run again.`);
      return;
    }
    cancelledRef.current = false;
    setRunning(true);
    setError(null);
    setItems(urls.map((url, index) => ({ index, url, status: "pending" as const })));
    try {
      await runBatch(urls, {
        onItem: (item) =>
          setItems((previous) => previous.map((row) => (row.index === item.index ? item : row))),
        isCancelled: () => cancelledRef.current,
      });
    } catch (cause) {
      setError(cause instanceof ApiFailure ? cause.message : "Something went wrong.");
      setItems([]);
    } finally {
      setRunning(false);
    }
  }

  const done = items.filter((item) => item.status !== "pending").length;
  const okCount = items.filter((item) => item.status === "ok").length;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-title font-semibold">Batch</h1>
        <p className="mt-1 text-body-sm text-muted-fg">
          Paste up to {BATCH_MAX} video URLs — one per line. They are extracted one at a time with a
          short pause between requests; a failure never stops the rest.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-body-sm font-medium">
        Video URLs
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={8}
          placeholder={"https://www.youtube.com/watch?v=...\nhttps://youtu.be/..."}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-caption text-foreground placeholder:text-muted-fg focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void handleRun()} disabled={running || urls.length === 0}>
          {running ? `Running… ${done}/${items.length}` : `Run batch (${urls.length})`}
        </Button>
        {running && (
          <Button variant="secondary" onClick={() => (cancelledRef.current = true)}>
            Cancel
          </Button>
        )}
        {urls.length > BATCH_MAX && (
          <span role="alert" className="text-caption text-error">
            {urls.length} URLs — the cap is {BATCH_MAX}.
          </span>
        )}
        {error && (
          <span role="alert" className="text-caption text-error">
            {error}
          </span>
        )}
        {!running && items.length > 0 && !error && (
          <span className="text-caption text-muted-fg" aria-live="polite">
            {okCount} ok · {items.length - okCount} failed
          </span>
        )}
      </div>

      {items.length > 0 && (
        <ol className="card divide-y divide-border" aria-live="polite">
          {items.map((item) => (
            <li key={item.index} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-caption text-muted-fg">{item.url}</p>
                {item.status === "error" && (
                  <p className="mt-0.5 truncate text-caption text-error">{item.error}</p>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-2 text-caption">
                {item.status === "pending" && <span className="text-muted-fg">Waiting…</span>}
                {item.status === "error" && <span className="text-error">Failed</span>}
                {item.status === "ok" && (
                  <>
                    <span className="text-primary">Done</span>
                    <Link
                      href={`/transcript?url=${encodeURIComponent(item.url)}`}
                      className="rounded-full border border-border px-3 py-1.5 transition-colors duration-150 hover:bg-surface"
                    >
                      Open
                    </Link>
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
