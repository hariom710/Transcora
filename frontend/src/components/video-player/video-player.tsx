"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Minimal typing for the pieces of the YouTube IFrame API we use — keeps
 * strict TS happy without adding @types/youtube as a dependency.
 */
interface YTPlayerInstance {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}

interface YTOptions {
  videoId: string;
  events: {
    onReady?: (event: { target: YTPlayerInstance }) => void;
    onStateChange?: (event: { data: number }) => void;
    onError?: () => void;
  };
}

interface YTNamespace {
  Player: new (element: HTMLElement, options: YTOptions) => YTPlayerInstance;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Loads www.youtube.com/iframe_api once per page; cached across components. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise<YTNamespace>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT as YTNamespace);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube IFrame API failed to load"));
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

export type PlayerCommand =
  | { id: number; action: "toggle" }
  | { id: number; action: "seek"; time: number };

interface VideoPlayerProps {
  videoId: string;
  /** Bumped id forces re-execution of a repeated command (same action twice). */
  command: PlayerCommand | null;
  onTime: (seconds: number) => void;
  onDuration: (seconds: number) => void;
  /** Script load failure or playback error — caller falls back to the thumbnail card. */
  onError: () => void;
}

export function VideoPlayer({ videoId, command, onTime, onDuration, onError }: VideoPlayerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const pausedRef = useRef(true);
  const onTimeRef = useRef(onTime);
  const onDurationRef = useRef(onDuration);
  const onErrorRef = useRef(onError);
  // Callbacks are read from refs inside effects/intervals; sync them there.
  useEffect(() => {
    onTimeRef.current = onTime;
    onDurationRef.current = onDuration;
    onErrorRef.current = onError;
  });
  // Ready is keyed to the video so switching videos resets it without a
  // synchronous setState in the setup effect.
  const [readyId, setReadyId] = useState<string | null>(null);
  const ready = readyId === videoId;

  useEffect(() => {
    const frame = frameRef.current;
    let disposed = false;
    loadYouTubeApi()
      .then((YT) => {
        if (disposed || !frame) return;
        // YT.Player replaces the host element with an iframe, so it must be
        // created imperatively — React does not own it.
        const host = document.createElement("div");
        frame.appendChild(host);
        playerRef.current = new YT.Player(host, {
          videoId,
          events: {
            onReady: () => {
              if (!disposed) setReadyId(videoId);
            },
            onStateChange: (event) => {
              // 1 = playing; buffering/paused/ended/cued all count as paused.
              pausedRef.current = event.data !== 1;
            },
            onError: () => {
              if (!disposed) onErrorRef.current();
            },
          },
        });
      })
      .catch(() => {
        if (!disposed) onErrorRef.current();
      });
    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      frame?.replaceChildren();
    };
  }, [videoId]);

  // Poll playback time and duration only while the player exists.
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      onTimeRef.current(player.getCurrentTime());
      const duration = player.getDuration();
      if (duration > 0) onDurationRef.current(duration);
    }, 500);
    return () => window.clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    if (!command || !ready) return;
    const player = playerRef.current;
    if (!player) return;
    if (command.action === "toggle") {
      if (pausedRef.current) player.playVideo();
      else player.pauseVideo();
    } else {
      // Clamp past-the-end seeks: playVideo() from the end state restarts the
      // video from 0, which reads as a bug when spamming "l" near the end.
      const duration = player.getDuration();
      const target = duration > 0 ? Math.min(command.time, duration - 0.5) : command.time;
      player.seekTo(Math.max(0, target), true);
      player.playVideo();
    }
  }, [command, ready]);

  return <div ref={frameRef} className="aspect-video w-full overflow-hidden rounded-md border border-border bg-black" />;
}
