"use client";

import { useCallback, useReducer } from "react";

import type { Edits } from "@/lib/productivity";

export interface EditHistory {
  past: Edits[];
  present: Edits;
  future: Edits[];
}

export type HistoryAction =
  | { type: "patch"; partial: Edits }
  | { type: "commit"; edits: Edits }
  | { type: "undo" }
  | { type: "redo" };

/** Caps history so a long editing session cannot grow without bound. */
const LIMIT = 50;

function same(a: Edits, b: Edits): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every((key) => a[Number(key)] === b[Number(key)])
  );
}

function commit(state: EditHistory, present: Edits): EditHistory {
  if (same(state.present, present)) return state;
  return {
    past: [...state.past, state.present].slice(-LIMIT),
    present,
    future: [],
  };
}

export function historyReducer(state: EditHistory, action: HistoryAction): EditHistory {
  switch (action.type) {
    case "patch":
      return commit(state, { ...state.present, ...action.partial });
    case "commit":
      return commit(state, action.edits);
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, LIMIT),
      };
    }
    case "redo": {
      const [next, ...future] = state.future;
      if (!next) return state;
      return {
        past: [...state.past, state.present].slice(-LIMIT),
        present: next,
        future,
      };
    }
  }
}

/** Transcript edits with undo/redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Y). */
export function useEditHistory(): {
  edits: Edits;
  canUndo: boolean;
  canRedo: boolean;
  patch: (partial: Edits) => void;
  commit: (edits: Edits) => void;
  undo: () => void;
  redo: () => void;
} {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: {},
    future: [],
  });
  const patch = useCallback(
    (partial: Edits) => dispatch({ type: "patch", partial }),
    [],
  );
  const commit = useCallback((edits: Edits) => dispatch({ type: "commit", edits }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  return {
    edits: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    patch,
    commit,
    undo,
    redo,
  };
}
