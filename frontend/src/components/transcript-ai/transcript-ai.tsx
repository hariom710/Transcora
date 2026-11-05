"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  AI_FEATURES,
  AiFailure,
  SPEAKER_PROMPT,
  applyLabels,
  buildTranscriptContext,
  generateContent,
  parseLabels,
  type ChatMessage,
} from "@/lib/gemini";
import type { Transcript } from "@/types";

// Only written on the explicit "remember" opt-in (SECURITY.md §H).
const KEY_STORAGE = "transcora-gemini-key";

function loadKey(): string {
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return ""; // Storage can be unavailable (private mode).
  }
}

interface TranscriptAiProps {
  transcript: Transcript;
  title?: string | null;
  onClose: () => void;
  /** Speaker-label changes, applied by the page as one undoable edit step. */
  onApplyLabels: (changes: Record<number, string>) => void;
}

export function TranscriptAi({ transcript, title, onClose, onApplyLabels }: TranscriptAiProps) {
  const [key, setKey] = useState(loadKey);
  const [keyInput, setKeyInput] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{ label: string; text: string } | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => buildTranscriptContext(transcript, title), [transcript, title]);

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

  function saveKey() {
    const trimmed = keyInput.trim();
    setKey(trimmed);
    try {
      if (remember && trimmed) window.localStorage.setItem(KEY_STORAGE, trimmed);
      else window.localStorage.removeItem(KEY_STORAGE);
    } catch {
      // Storage can be unavailable; the key still works for this session.
    }
  }

  function forgetKey() {
    setKey("");
    setKeyInput("");
    setRemember(false);
    try {
      window.localStorage.removeItem(KEY_STORAGE);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }

  function failed(cause: unknown): string {
    return cause instanceof AiFailure
      ? cause.message
      : "Something went wrong. Please try again.";
  }

  async function runFeature(label: string, prompt: string) {
    setBusy(true);
    setError(null);
    try {
      const text = await generateContent({
        key,
        system: context.system,
        messages: [{ role: "user", text: prompt }],
      });
      setOutput({ label, text });
    } catch (cause) {
      setError(failed(cause));
    } finally {
      setBusy(false);
    }
  }

  async function runLabels() {
    setBusy(true);
    setError(null);
    try {
      const json = await generateContent({
        key,
        system: context.system,
        messages: [{ role: "user", text: SPEAKER_PROMPT }],
        json: true,
      });
      const validIds = new Set(transcript.segments.map((segment) => segment.id));
      const changes = applyLabels(transcript.segments, parseLabels(json, validIds));
      onApplyLabels(changes);
      setOutput({
        label: "Speaker labels",
        text: `Applied speaker labels to ${Object.keys(changes).length} segments. Undo with Ctrl+Z.`,
      });
    } catch (cause) {
      setError(failed(cause));
    } finally {
      setBusy(false);
    }
  }

  async function ask() {
    const question = chatInput.trim();
    if (!question) return;
    const history: ChatMessage[] = [...chat, { role: "user", text: question }];
    setBusy(true);
    setChatError(null);
    try {
      const answer = await generateContent({
        key,
        system: context.system,
        messages: history,
      });
      setChat([...history, { role: "model", text: answer }]);
      setChatInput("");
    } catch (cause) {
      setChatError(failed(cause));
    } finally {
      setBusy(false);
    }
  }

  function handleAskKeys(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !busy && key) {
      event.preventDefault();
      void ask();
    }
  }

  const disabled = !key || busy;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        className="card flex w-full max-w-2xl flex-col gap-4 overflow-y-auto p-5 shadow-lg focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="ai-dialog-title" className="text-body font-semibold">
            AI features
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Key settings — SECURITY.md §H disclosure lives here, in the UI. */}
        <section aria-label="Gemini API key" className="flex flex-col gap-2 rounded-md border border-border p-3">
          <label className="flex flex-wrap items-center gap-2 text-body-sm">
            Gemini API key
            <Input
              type="password"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              placeholder="AIza..."
              autoComplete="off"
              spellCheck={false}
              aria-label="Gemini API key"
              className="h-10 min-w-0 flex-1 font-mono"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={saveKey} disabled={!keyInput.trim()}>
              Use key
            </Button>
            <label className="flex cursor-pointer items-center gap-2 text-caption text-muted-fg">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Remember on this browser
            </label>
            {key && (
              <Button variant="ghost" size="sm" onClick={forgetKey} className="text-error">
                Forget key
              </Button>
            )}
          </div>
          <p className="text-caption text-muted-fg">
            Your key is sent only to Google&apos;s API (generativelanguage.googleapis.com) from this
            browser — never to Transcora&apos;s servers, never logged. Anyone with access to this
            browser can read a key you ask it to remember. Get a free key at aistudio.google.com.
          </p>
          {key ? (
            <p className="text-caption text-primary">
              Key active{remember ? " and remembered on this browser" : " for this session only"}.
            </p>
          ) : (
            <p className="text-caption text-muted-fg">Add a free key to enable AI.</p>
          )}
        </section>

        {context.truncated && (
          <p className="rounded-md bg-surface px-3 py-2 text-caption text-muted-fg">
            Long transcript: using the first 400,000 of {context.totalChars.toLocaleString()}{" "}
            characters.
          </p>
        )}

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="AI actions">
          {AI_FEATURES.map((feature) => (
            <Button
              key={feature.id}
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => void runFeature(feature.label, feature.prompt)}
            >
              {feature.label}
            </Button>
          ))}
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => void runLabels()}
            title="Prefix each segment with a speaker label (undoable)"
          >
            Speaker labels
          </Button>
        </div>

        <div aria-live="polite" className="flex flex-col gap-2">
          {busy && <p className="text-caption text-muted-fg">Generating…</p>}
          {error && (
            <p role="alert" className="text-caption text-error">
              {error}
            </p>
          )}
        </div>

        {output && (
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption text-muted-fg">{output.label}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void navigator.clipboard?.writeText(output.text)}
              >
                Copy
              </Button>
            </div>
            {/* Plain text only — AI output is never rendered as HTML (SECURITY.md §H). */}
            <p className="whitespace-pre-wrap text-body-sm">{output.text}</p>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <span className="text-caption font-medium">Ask this video</span>
          {chat.map((message, index) => (
            <p
              key={index}
              className={cn(
                "whitespace-pre-wrap text-body-sm",
                message.role === "user" ? "text-foreground" : "text-muted-fg",
              )}
            >
              {message.text}
            </p>
          ))}
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={handleAskKeys}
              placeholder="Ask a question about this transcript..."
              aria-label="Ask this video"
              disabled={!key}
              className="h-11 min-w-0 flex-1 sm:h-9"
            />
            <Button onClick={() => void ask()} disabled={disabled || !chatInput.trim()}>
              Ask
            </Button>
          </div>
          {chatError && (
            <p role="alert" className="text-caption text-error">
              {chatError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
