"use client";

import { useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TranscriptSearchProps {
  query: string;
  onQueryChange: (value: string) => void;
  matchCount: number;
  activeMatch: number;
  onPrevious: () => void;
  onNext: () => void;
  /** Replacement text for the find-and-replace row. */
  replacement: string;
  onReplacementChange: (value: string) => void;
  /** Applies the replacement to every matching segment. */
  onReplaceAll: () => void;
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
  replacement,
  onReplacementChange,
  onReplaceAll,
  inputRef,
}: TranscriptSearchProps) {
  const hasQuery = query.length > 0;
  const [replaceOpen, setReplaceOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-col gap-2 lg:flex-1">
      <div className="flex items-center gap-2">
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReplaceOpen((open) => !open)}
          aria-pressed={replaceOpen}
          aria-expanded={replaceOpen}
          title="Find and replace"
        >
          Replace
        </Button>
      </div>

      {replaceOpen && (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Replace with..."
            value={replacement}
            onChange={(event) => onReplacementChange(event.target.value)}
            aria-label="Replace with"
            className="h-11 min-w-0 flex-1 sm:h-9"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={onReplaceAll}
            disabled={!matchCount}
            title="Replace every match in the transcript"
          >
            Replace all{hasQuery ? ` (${matchCount})` : ""}
          </Button>
        </div>
      )}
    </div>
  );
}
