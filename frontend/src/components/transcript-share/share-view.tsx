"use client";

import { useEffect, useState } from "react";

import { formatClock } from "@/lib/timestamp";
import { ApiFailure, fetchShare } from "@/services/api";
import type { Transcript } from "@/types";

/** Read-only view of a shared transcript (ADR-011). Content renders as plain
    React text — shared payloads are untrusted (SECURITY.md §F). */
export function ShareView({ token }: { token: string }) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchShare(token)
      .then((value) => {
        if (!cancelled) setTranscript(value);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof ApiFailure ? cause.message : "Something went wrong. Please try again.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <p className="text-body-sm text-muted-fg">Loading shared transcript…</p>;
  }

  if (!transcript) {
    return (
      <div className="card p-5">
        <h1 className="text-body font-semibold">Transcript unavailable</h1>
        <p className="mt-1 text-body-sm text-muted-fg">{error}</p>
      </div>
    );
  }

  const words = transcript.segments.reduce(
    (total, segment) => total + segment.text.split(/\s+/).filter(Boolean).length,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-body font-semibold">Shared transcript</h1>
          <p className="mt-0.5 text-caption text-muted-fg">
            {transcript.language} · {transcript.segments.length} segments · {words} words
          </p>
        </div>
        <p className="max-w-sm text-caption text-muted-fg">
          Shared via Transcora — readable by anyone with this link until it expires.
        </p>
      </div>

      <div className="card divide-y divide-border">
        {transcript.segments.map((segment) => (
          <article key={segment.id} className="flex gap-3 px-4 py-3 sm:px-5">
            <a
              href={`https://www.youtube.com/watch?v=${transcript.video_id}&t=${Math.floor(segment.start)}s`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 shrink-0 pt-0.5 font-mono text-caption tabular-nums text-muted-fg transition-colors duration-150 hover:text-primary"
            >
              {formatClock(segment.start)}
            </a>
            <p className="min-w-0 whitespace-pre-wrap text-body-sm">{segment.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
