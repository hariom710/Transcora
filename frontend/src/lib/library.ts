import type { Transcript } from "@/types";

/** A transcript saved in the browser's IndexedDB (library or recent list). */
export interface LibraryEntry {
  /** video_id — real for extracted videos, synthetic for imports. */
  id: string;
  title: string;
  channel: string | null;
  thumbnail_url: string | null;
  language: string;
  saved_at: number;
  transcript: Transcript;
}

const DB_NAME = "transcora-library";
const DB_VERSION = 1;
const SAVED = "saved";
const RECENT = "recent";
export const RECENT_LIMIT = 20;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support local storage."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SAVED)) db.createObjectStore(SAVED, { keyPath: "id" });
      if (!db.objectStoreNames.contains(RECENT)) db.createObjectStore(RECENT, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the library."));
  });
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = action(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error("Library operation failed."));
        tx.oncomplete = () => db.close();
        tx.onabort = () => {
          db.close();
          reject(request.error ?? new Error("Library operation was aborted."));
        };
      }),
  );
}

export function saveTranscript(entry: LibraryEntry): Promise<void> {
  return run<void>(SAVED, "readwrite", (store) => store.put(entry));
}

export async function listSaved(): Promise<LibraryEntry[]> {
  const entries = await run<LibraryEntry[]>(SAVED, "readonly", (store) => store.getAll());
  return entries.sort((a, b) => b.saved_at - a.saved_at);
}

export async function listRecent(): Promise<LibraryEntry[]> {
  const entries = await run<LibraryEntry[]>(RECENT, "readonly", (store) => store.getAll());
  return entries.sort((a, b) => b.saved_at - a.saved_at);
}

/** Looks the id up in the library first, then in the recent list. */
export async function getStored(id: string): Promise<LibraryEntry | null> {
  const saved = await run<LibraryEntry | undefined>(SAVED, "readonly", (store) => store.get(id));
  if (saved) return saved;
  return (await run<LibraryEntry | undefined>(RECENT, "readonly", (store) => store.get(id))) ?? null;
}

export function removeSaved(id: string): Promise<void> {
  return run<void>(SAVED, "readwrite", (store) => store.delete(id));
}

/** Best-effort auto-record of an opened transcript; keeps only the newest entries. */
export async function recordRecent(transcript: Transcript, title: string | null): Promise<void> {
  const entry: LibraryEntry = {
    id: transcript.video_id,
    title: title || transcript.video_id,
    channel: null,
    thumbnail_url: null,
    language: transcript.language,
    saved_at: Date.now(),
    transcript,
  };
  await run<void>(RECENT, "readwrite", (store) => store.put(entry));
  const entries = await run<LibraryEntry[]>(RECENT, "readonly", (store) => store.getAll());
  const overflow = entries.sort((a, b) => b.saved_at - a.saved_at).slice(RECENT_LIMIT);
  for (const stale of overflow) {
    await run<void>(RECENT, "readwrite", (store) => store.delete(stale.id));
  }
}
