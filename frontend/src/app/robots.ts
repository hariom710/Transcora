import type { MetadataRoute } from "next";

// Shared transcript pages are unlisted by design (SECURITY.md §N/G).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/s/"] }],
  };
}
