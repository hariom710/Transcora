import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Header } from "@/components/layout/header";

import "./globals.css";

// Absolute URLs (OG, sitemap) need the deployed origin; set at T6 deploy (ARCHITECTURE.md §J).
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Free YouTube Transcript Generator",
  description:
    "Convert YouTube videos into searchable transcripts. Simple, fast and free — no account required.",
  openGraph: {
    siteName: "Transcora",
    title: "Free YouTube Transcript Generator",
    description:
      "Convert YouTube videos into searchable transcripts. Simple, fast and free — no account required.",
    type: "website",
    url: SITE,
  },
  twitter: {
    card: "summary",
    title: "Free YouTube Transcript Generator",
    description:
      "Convert YouTube videos into searchable transcripts. Simple, fast and free — no account required.",
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1d1f" },
  ],
};

// Applies the stored theme before first paint to avoid a light/dark flash.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("transcora-theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-caption text-muted-fg sm:flex-row sm:items-center sm:justify-between">
            <p>Transcora — extracts available YouTube captions. Does not transcribe audio.</p>
            <nav aria-label="Footer" className="flex gap-5">
              <a href="/about" className="transition-colors duration-150 hover:text-foreground">
                About
              </a>
              <a href="/privacy" className="transition-colors duration-150 hover:text-foreground">
                Privacy
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
