"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiFailure, createShare } from "@/services/api";
import type { ShareCreated, Transcript } from "@/types";

interface ShareDialogProps {
  transcript: Transcript;
  onClose: () => void;
}

export function ShareDialog({ transcript, onClose }: ShareDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShareCreated | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      setResult(await createShare(transcript, acknowledged));
    } catch (cause) {
      setError(
        cause instanceof ApiFailure ? cause.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        className="card flex w-full max-w-xl flex-col gap-4 overflow-y-auto p-5 shadow-lg focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="share-dialog-title" className="text-body font-semibold">
            Share transcript
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* In-product consent disclosure — SECURITY.md §N requires it here. */}
        <p className="text-body-sm text-muted-fg">
          Creating a link publishes this transcript to Transcora&apos;s server so{" "}
          <strong className="font-medium text-foreground">anyone with the link can read it</strong>,
          without an account. It stays stored until it expires automatically{" "}
          <strong className="font-medium text-foreground">30 days after creation</strong>, or until
          you delete it with the one-time delete token shown once below. Nothing is shared until you
          press Create link, and nothing is shared automatically.
        </p>

        <label className="flex cursor-pointer items-start gap-2 text-body-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          I understand this transcript becomes readable by anyone who gets the link.
        </label>

        <div className="flex items-center gap-2">
          <Button onClick={() => void handleCreate()} disabled={!acknowledged || busy}>
            {busy ? "Creating…" : result ? "Create another link" : "Create link"}
          </Button>
          {error && (
            <span role="alert" className="text-caption text-error">
              {error}
            </span>
          )}
        </div>

        {result && (
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <label className="flex flex-col gap-1.5 text-caption text-muted-fg">
              Share link
              <span className="flex gap-2">
                <input
                  readOnly
                  value={result.share_url}
                  onFocus={(event) => event.target.select()}
                  aria-label="Share link"
                  className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-caption"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void navigator.clipboard?.writeText(result.share_url)}
                >
                  Copy
                </Button>
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-caption text-muted-fg">
              Delete token — shown once
              <span className="flex gap-2">
                <input
                  readOnly
                  value={result.delete_token}
                  onFocus={(event) => event.target.select()}
                  aria-label="Delete token"
                  className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-caption"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void navigator.clipboard?.writeText(result.delete_token)}
                >
                  Copy
                </Button>
              </span>
            </label>
            <p className="text-caption text-error">
              Save the delete token now — it is shown only once and is the only way to delete this
              share early.
            </p>
            <p className="text-caption text-muted-fg">
              Expires {new Date(result.expires_at).toLocaleDateString()} · {transcript.segments.length}{" "}
              segments.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
