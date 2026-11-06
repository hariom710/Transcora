"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

const LINKS = [
  { href: "/", label: "Transcript" },
  { href: "/library", label: "Library" },
  { href: "/batch", label: "Batch" },
  { href: "/#features", label: "Features" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
];

export function Header() {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    active
      ? "rounded-full bg-surface px-3 py-1.5 text-caption font-medium text-foreground"
      : "rounded-full px-3 py-1.5 text-caption text-muted-fg transition-colors duration-150 hover:text-foreground";

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          Transcora
        </Link>

        <div className="flex items-center gap-1">
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.href === pathname ? "page" : undefined}
                className={linkClass(link.href === pathname)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="ml-1 w-11 sm:w-8"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>

          {/* Mobile navigation: native disclosure, no JS state needed. */}
          <details
            className="relative sm:hidden"
            onClick={(event) => {
              // Navigate-and-close: any link click collapses the menu.
              if ((event.target as HTMLElement).closest("a")) {
                (event.currentTarget as HTMLDetailsElement).removeAttribute("open");
              }
            }}
          >
            <summary
              aria-label="Open navigation menu"
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full text-foreground hover:bg-surface sm:h-8 sm:w-8"
            >
              <MenuIcon />
            </summary>
            <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-border bg-background p-2 shadow-lg">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={link.href === pathname ? "page" : undefined}
                  className="block rounded-md px-3 py-3 text-caption text-foreground hover:bg-surface"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
