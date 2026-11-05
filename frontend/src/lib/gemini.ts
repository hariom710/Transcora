import type { Transcript, TranscriptSegment } from "@/types";
import { formatClock } from "./timestamp";
import type { Edits } from "./productivity";

// Free-tier model verified 2026-11-05: gemini-3.6/3.8-flash and the
// Flash-Lite models are free without billing; Gemini 4 Argon is paid-only.
// shortcut: one hardcoded model id — bump this constant if Google retires it.
export const GEMINI_MODEL = "gemini-3.6-flash";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 60_000;
// ~100k tokens: free-tier Flash handles far more, but input-token per-minute
// limits make a huge single request more likely to hit quota than useful.
export const MAX_TRANSCRIPT_CHARS = 400_000;

export type AiErrorKind =
  | "missing-key"
  | "invalid-key"
  | "quota"
  | "timeout"
  | "network"
  | "bad-response"
  | "request";

/** Safe, user-facing failure. The message is the whole UI contract — never
    includes the key, stack traces or provider internals (SECURITY.md §H). */
export class AiFailure extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export type AiFeature = "summary" | "keypoints" | "notes" | "chapters" | "topics" | "learning";

export const AI_FEATURES: ReadonlyArray<{ id: AiFeature; label: string; prompt: string }> = [
  {
    id: "summary",
    label: "Summary",
    prompt: "Summarize this video transcript in three short paragraphs. Plain text only.",
  },
  {
    id: "keypoints",
    label: "Key points",
    prompt:
      "List the 5-8 key points of this transcript, each line starting with '- '. Plain text only.",
  },
  {
    id: "notes",
    label: "Smart notes",
    prompt:
      "Turn this transcript into concise study notes: short grouped bullet points, plain text only.",
  },
  {
    id: "chapters",
    label: "Chapters",
    prompt:
      "Split this transcript into chapters. For each chapter output a line 'MM:SS — Chapter title' using timestamps present in the transcript, then one or two description lines. Plain text only.",
  },
  {
    id: "topics",
    label: "Topics",
    prompt: "List the main topics covered, one per line starting with '- '. Plain text only.",
  },
  {
    id: "learning",
    label: "Learning notes",
    prompt:
      "Write 5-8 study questions with answers drawn from this transcript. Format each as 'Q: ...' followed by 'A: ...'. Plain text only.",
  },
];

export const SPEAKER_PROMPT =
  "Identify the speakers in this transcript and label every segment. Respond ONLY with JSON: " +
  '{"labels":[{"id":<segment id>,"speaker":"Speaker 1"}]} — every id must be one of the ' +
  "segment ids provided. Use a stable name per person and no other keys.";

const SYSTEM_PREFIX =
  "You are a transcript assistant. Answer only from the transcript below; if the answer is not in it, say so. Never output HTML.";

export interface TranscriptContext {
  system: string;
  truncated: boolean;
  totalChars: number;
}

/** Builds the system prompt carrying the transcript; truncates very long
    transcripts loudly — context.truncated must be surfaced in the UI. */
export function buildTranscriptContext(
  t: Transcript,
  title?: string | null,
): TranscriptContext {
  const header = `Video: ${title || t.video_id}\nLanguage: ${t.language}\nTimestamped transcript:\n`;
  const body = t.segments.map((s) => `[${formatClock(s.start)}] ${s.text}`).join("\n");
  const full = header + body;
  const totalChars = full.length;
  if (totalChars <= MAX_TRANSCRIPT_CHARS) {
    return { system: `${SYSTEM_PREFIX}\n\n${full}`, truncated: false, totalChars };
  }
  return {
    system:
      `${SYSTEM_PREFIX}\n\n${full.slice(0, MAX_TRANSCRIPT_CHARS)}` +
      `\n\n[Transcript truncated at ${MAX_TRANSCRIPT_CHARS} characters of ${totalChars} — later content omitted.]`,
    truncated: true,
    totalChars,
  };
}

/** Maps a non-2xx Gemini response to a safe, distinct user message. */
export function mapHttpError(status: number, body: string): AiFailure {
  if (status === 429) {
    return new AiFailure(
      "quota",
      "Free-tier rate limit or quota reached. Wait about a minute, then try again.",
    );
  }
  if (/API_KEY_INVALID|API key not valid/i.test(body)) {
    return new AiFailure("invalid-key", "Google rejected that API key. Check it and try again.");
  }
  if (status === 403) {
    return new AiFailure("invalid-key", "Google refused this key. Check its permissions and try again.");
  }
  if (status === 404) {
    return new AiFailure("request", "The AI model is unavailable right now. Try again later.");
  }
  return new AiFailure("request", `Google's API returned an error (${status}). Try again.`);
}

/** Safely pulls the plain text out of a Gemini response envelope. */
export function extractText(data: unknown): string {
  const candidates = (data as { candidates?: unknown } | null)?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const content = (candidates[0] as { content?: { parts?: unknown } } | null)?.content;
  const parts = content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => part as { text?: unknown; thought?: unknown } | null)
    // Thinking models mark reasoning parts — never show them as the answer.
    .filter((part) => part?.thought !== true)
    .map((part) => part?.text)
    .filter((text): text is string => typeof text === "string")
    .join("");
}

const LABEL_SCHEMA = {
  type: "OBJECT",
  properties: {
    labels: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "INTEGER" },
          speaker: { type: "STRING" },
        },
        required: ["id", "speaker"],
      },
    },
  },
  required: ["labels"],
};

export interface GenerateArgs {
  key: string;
  system: string;
  messages: ChatMessage[];
  /** Requests a JSON response constrained by the speaker-label schema. */
  json?: boolean;
}

/** Direct browser call to Google — the key goes to Google only, never to our
    backend (ADR-009 / SECURITY.md §H). */
export async function generateContent(args: GenerateArgs): Promise<string> {
  const key = args.key.trim();
  if (!key) {
    throw new AiFailure("missing-key", "Add your Gemini API key to use AI features.");
  }
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: args.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig: args.json
          ? { responseMimeType: "application/json", responseSchema: LABEL_SCHEMA }
          : {},
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    if (cause instanceof DOMException && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
      throw new AiFailure("timeout", "The request timed out. Check your connection and try again.");
    }
    throw new AiFailure("network", "Could not reach Google's API. Check your internet connection.");
  }
  const body = await res.text();
  if (!res.ok) throw mapHttpError(res.status, body);
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new AiFailure("bad-response", "The model returned an unreadable response. Try again.");
  }
  const text = extractText(data);
  if (!text.trim()) {
    throw new AiFailure("bad-response", "The model returned an empty response. Try again.");
  }
  return text;
}

/** Validates the JSON speaker-label payload against real segment ids. */
export function parseLabels(
  json: string,
  validIds: ReadonlySet<number>,
): Array<{ id: number; speaker: string }> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new AiFailure("bad-response", "The model returned unreadable label data. Try again.");
  }
  const labels = (data as { labels?: unknown } | null)?.labels;
  if (!Array.isArray(labels)) {
    throw new AiFailure("bad-response", "The model returned unexpected label data. Try again.");
  }
  const out: Array<{ id: number; speaker: string }> = [];
  for (const item of labels) {
    if (typeof item !== "object" || item === null) continue;
    const { id, speaker } = item as { id?: unknown; speaker?: unknown };
    if (typeof id !== "number" || !validIds.has(id)) continue;
    if (typeof speaker !== "string") continue;
    // Bracket/newline characters become spaces so our own "[label]" stays balanced.
    const clean = speaker.replace(/[[\]\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
    if (clean) out.push({ id, speaker: clean });
  }
  if (out.length === 0) {
    throw new AiFailure("bad-response", "No usable speaker labels came back. Try again.");
  }
  return out;
}

/** Applies labels as "[Speaker] text" prefixes; skips segments already tagged
    (existing speakers or music cues like "[♪]"). Returns only changed rows. */
export function applyLabels(
  segments: readonly TranscriptSegment[],
  labels: ReadonlyArray<{ id: number; speaker: string }>,
): Edits {
  const byId = new Map(labels.map((label) => [label.id, label.speaker]));
  const changes: Edits = {};
  for (const segment of segments) {
    const speaker = byId.get(segment.id);
    if (!speaker) continue;
    // Already tagged: an earlier speaker label or a music cue like "[♪♪♪]".
    if (/^\[[^\]]{1,40}\]/.test(segment.text)) continue;
    changes[segment.id] = `[${speaker}] ${segment.text}`;
  }
  return changes;
}
