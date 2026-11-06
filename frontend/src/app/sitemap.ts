import type { MetadataRoute } from "next";

// Absolute URLs need the deployed origin; set at T6 deploy (ARCHITECTURE.md §J).
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Static, indexable pages only: /transcript is query-driven, /s/[token] is noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/library`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/batch`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/about`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.4 },
  ];
}
