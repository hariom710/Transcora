import { formatClock } from "@/lib/timestamp";
import type { Video } from "@/types";

export function VideoPreview({ video }: { video: Video | null }) {
  if (!video) return null;

  const duration = video.duration ? ` · ${formatClock(video.duration)}` : "";

  return (
    <div className="card flex items-start gap-4 p-4 sm:p-5">
      {video.thumbnail_url && (
        // Remote YouTube thumbnail.
        <img
          src={video.thumbnail_url}
          alt=""
          loading="lazy"
          className="h-20 w-36 shrink-0 rounded-md border border-border object-cover sm:h-24 sm:w-40"
        />
      )}
      <div className="min-w-0">
        <h2 className="truncate text-body font-semibold">{video.title || "Untitled video"}</h2>
        <p className="mt-0.5 truncate text-caption text-muted-fg">
          {video.channel || "Unknown channel"}
          {duration}
        </p>
      </div>
    </div>
  );
}
