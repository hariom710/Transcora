"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "transcora-font-size";

/** Transcript font sizes for the A−/A+ controls; the index is what persists. */
export const FONT_SIZES = ["text-body-sm", "text-body", "text-lg"];

// Same-tab writes must notify React; the `storage` event only fires cross-tab.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): number {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "1" || stored === "2" ? Number(stored) : 0;
  } catch {
    return 0; // Storage can be unavailable (private mode).
  }
}

function getServerSnapshot(): number {
  return 0;
}

/** Transcript font size, persisted like the theme (use-theme.ts pattern). */
export function useFontSize(): { scale: number; change: (delta: number) => void } {
  const scale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const change = useCallback((delta: number) => {
    const next = Math.min(FONT_SIZES.length - 1, Math.max(0, getSnapshot() + delta));
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Storage can be unavailable (private mode); the scale still applies.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { scale, change };
}
