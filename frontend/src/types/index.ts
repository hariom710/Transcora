export interface Video {
  id: string;
  url: string;
  title?: string | null;
  channel?: string | null;
  thumbnail_url?: string | null;
  duration?: number | null;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  duration: number;
  text: string;
}

export interface Transcript {
  video_id: string;
  language: string;
  language_code: string;
  is_generated: boolean;
  segments: TranscriptSegment[];
}

export interface LanguageInfo {
  code: string;
  name: string;
  is_generated: boolean;
}

export interface LanguageList {
  video_id: string;
  languages: LanguageInfo[];
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
