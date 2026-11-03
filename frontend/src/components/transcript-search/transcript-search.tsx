"use client";

import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TranscriptSearchProps {
  query: string;
  onQueryChange: (value: string) => void;
  matchCount: number;
  activeMatch: number;
  onPrevious: () => void;
  onNext: () => void;
  /** Lets the page focus the field from the "/" keyboard shortcut. */
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function TranscriptSearch({
  query,
  onQueryChange,
  matchCount,
  activeMatch,
  onPrevious,
  onNext,
  inputRef,
}: TranscriptSearchProps) {
  const hasQuery = query.length > 0;

  return (
    <div className="flex min-w-0 items-center gap-2 lg:flex-1">
      <Input
        ref={inputRef}
        type="search"
        placeholder="Search transcript..."
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        aria-label="Search transcript"
        className="h-11 min-w-0 flex-1 sm:h-9"
      />
      {hasQuery && (
        <span
          className="min-w-16 text-right font-mono text-caption tabular-nums text-muted-fg"
          aria-live="polite"
        >
          {`${activeMatch}/${matchCount}`}
        </span>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={onPrevious}
        disabled={!matchCount}
        aria-label="Previous match"
      >
        ↑
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onNext}
        disabled={!matchCount}
        aria-label="Next match"
      >
        ↓
      </Button>
    </div>
  );
}
