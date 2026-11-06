"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { parseImport } from "@/lib/importers";
import {
  listRecent,
  listSaved,
  saveTranscript,
  type LibraryEntry,
} from "@/lib/library";

const IMPORT_ACCEPT = ".txt,.srt,.vtt,.md,text/plain";

export default function LibraryPage() {
  const router = useRouter();
  const [saved, setSaved] = useState<LibraryEntry[]>([]);
  const [recent, setRecent] = useState<LibraryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    Promise.all([listSaved(), listRecent()])
      .then(([savedEntries, recentEntries]) => {
        setSaved(savedEntries);
        setRecent(recentEntries);
        setError(null);
      })
      .catch(() => setError("Could not read the local library in this browser."));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleImport(file: File) {
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const transcript = parseImport(file.name, text);
      await saveTranscript({
        id: transcript.video_id,
        title: file.name.replace(/\.[^.]+$/, ""),
        channel: "Imported file",
        thumbnail_url: null,
        language: transcript.language,
        saved_at: Date.now(),
        transcript,
      });
      router.push(`/transcript?saved=${transcript.video_id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That file could not be imported.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold">Library</h1>
          <p className="mt-1 text-body-sm text-muted-fg">
            Saved and recently opened transcripts live in this browser only — nothing is uploaded.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={IMPORT_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleImport(file);
          }}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? "Importing…" : "Import file"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-body font-semibold">
          Saved{" "}
          <span className="text-caption font-normal text-muted-fg">({saved.length})</span>
        </h2>
        <div className="card divide-y divide-border">
          {saved.length === 0 ? (
            <p className="px-4 py-5 text-body-sm text-muted-fg">
              Nothing saved yet. Open a transcript and press ★ Save to keep it here.
            </p>
          ) : (
            saved.map((entry) => <EntryRow key={entry.id} entry={entry} onRemoved={refresh} />)
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-body font-semibold">
          Recent{" "}
          <span className="text-caption font-normal text-muted-fg">({recent.length})</span>
        </h2>
        <div className="card divide-y divide-border">
          {recent.length === 0 ? (
            <p className="px-4 py-5 text-body-sm text-muted-fg">
              Transcripts you open appear here automatically.
            </p>
          ) : (
            recent.map((entry) => <EntryRow key={entry.id} entry={entry} />)
          )}
        </div>
      </section>
    </div>
  );
}

function EntryRow({ entry, onRemoved }: { entry: LibraryEntry; onRemoved?: () => void }) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      const { removeSaved } = await import("@/lib/library");
      await removeSaved(entry.id);
      onRemoved?.();
    } catch {
      setRemoving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-body-sm font-medium">{entry.title}</p>
        <p className="truncate text-caption text-muted-fg">
          {entry.channel ? `${entry.channel} · ` : ""}
          {entry.transcript.segments.length} segments ·{" "}
          {new Date(entry.saved_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href={`/transcript?saved=${entry.id}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-medium transition-all duration-150 hover:bg-surface active:scale-[0.98] sm:h-8 sm:px-3 sm:text-xs"
        >
          Open
        </Link>
        {onRemoved && (
          <Button variant="ghost" size="sm" onClick={() => void handleRemove()} disabled={removing}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
