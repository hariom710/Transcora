import type { Metadata } from "next";

import { ShareView } from "@/components/transcript-share/share-view";

// Share pages never enter search indexes (SECURITY.md §N/G); robots.txt
// additionally disallows /s/.
export const metadata: Metadata = {
  title: "Shared transcript — Transcora",
  robots: { index: false, follow: false },
};

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <ShareView token={token} />
    </div>
  );
}
