import { formatClock } from "@/lib/timestamp";
import type { Video } from "@/types";

export function VideoPreview({ video }: { video: Video | null }) {
  if (!video) return null;

  const duration = video.duration ? ` · ${formatClock(video.duration)}` : "";

  return (
    <div className="flex items-start gap-4">
      {video.thumbnail_url && (
        // Remote YouTube thumbnail.
        <img
          src={video.thumbnail_url}
          alt=""
          className="h-24 w-40 shrink-0 rounded-md border border-border object-cover"
        />
      )}
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold">{video.title || "Untitled video"}</h2>
        <p className="truncate text-sm text-muted-fg">
          {video.channel || "Unknown channel"}
          {duration}
        </p>
      </div>
    </div>
  );
}
