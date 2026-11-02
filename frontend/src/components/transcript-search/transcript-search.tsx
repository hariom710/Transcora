"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TranscriptSearchProps {
  query: string;
  onQueryChange: (value: string) => void;
  matchCount: number;
  activeMatch: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function TranscriptSearch({
  query,
  onQueryChange,
  matchCount,
  activeMatch,
  onPrevious,
  onNext,
}: TranscriptSearchProps) {
  const hasQuery = query.length > 0;

  return (
    <div className="flex flex-1 items-center gap-2">
      <Input
        type="search"
        placeholder="Search transcript..."
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        aria-label="Search transcript"
        className="h-9"
      />
      <span
        className="min-w-16 text-right text-sm tabular-nums text-muted-fg"
        aria-live="polite"
      >
        {hasQuery ? `${activeMatch}/${matchCount}` : ""}
      </span>
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
