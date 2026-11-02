import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Header } from "@/components/layout/header";

import "./globals.css";

export const metadata: Metadata = {
  title: "Free YouTube Transcript Generator",
  description:
    "Convert YouTube videos into searchable transcripts. Simple, fast and free — no account required.",
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
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-fg sm:flex-row sm:items-center sm:justify-between">
            <p>Transcora — extracts available YouTube captions. Does not transcribe audio.</p>
            <p>
              <a href="/privacy" className="hover:text-foreground">
                Privacy
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
