import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Transcora — Free YouTube Transcript Generator",
    short_name: "Transcora",
    description:
      "Convert YouTube videos into searchable transcripts. Simple, fast and free — no account required.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0071e3",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
