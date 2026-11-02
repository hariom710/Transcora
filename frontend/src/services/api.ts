import type { ApiErrorBody, LanguageList, Transcript, Video } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new ApiFailure(
      "NETWORK_ERROR",
      "Could not reach the server. Make sure the backend is running.",
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const body = data as ApiErrorBody | null;
    throw new ApiFailure(
      body?.error?.code ?? "UNKNOWN_ERROR",
      body?.error?.message ?? "Something went wrong. Please try again.",
    );
  }

  return data as T;
}

export function extractTranscript(url: string, language?: string): Promise<Transcript> {
  return request<Transcript>("/api/v1/transcripts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, language: language || null }),
  });
}

export function inspectVideo(url: string): Promise<Video> {
  return request<Video>("/api/v1/videos/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export function listLanguages(videoId: string): Promise<LanguageList> {
  return request<LanguageList>(`/api/v1/videos/${videoId}/languages`);
}
