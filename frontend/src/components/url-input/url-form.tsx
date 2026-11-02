"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseVideoId } from "@/lib/url";

const INVALID_MESSAGE = "That doesn't look like a supported YouTube video URL.";

export function UrlForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Client-side validation is UX only; the server enforces it (SECURITY.md §B).
    if (!parseVideoId(value)) {
      setError(INVALID_MESSAGE);
      return;
    }
    setError(null);
    router.push(`/transcript?url=${encodeURIComponent(value.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      <label htmlFor="youtube-url" className="mb-2 block text-sm font-medium">
        YouTube video URL
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="youtube-url"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="Paste your YouTube link here..."
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "youtube-url-error" : "youtube-url-hint"}
          className="h-11 flex-1"
        />
        <Button type="submit" size="lg" className="h-11">
          Generate Transcript
        </Button>
      </div>
      <p id="youtube-url-hint" className="mt-2 text-sm text-muted-fg">
        No account required · Free exports
      </p>
      {error && (
        <p id="youtube-url-error" role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </form>
  );
}
