import { UrlForm } from "@/components/url-input/url-form";

const STEPS = [
  { title: "Paste URL", body: "Drop in any YouTube video link." },
  { title: "Get transcript", body: "Available captions arrive in seconds." },
  { title: "Export", body: "TXT, SRT, VTT, Markdown or PDF." },
];

const FEATURES = [
  "Timestamped, clickable transcript",
  "Search with highlighted matches",
  "Edit segments before exporting",
  "Manual and auto-generated captions",
  "Language selection where available",
  "No account, no payment, no tracking",
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col items-center gap-6 pt-8 text-center">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          YouTube Transcript Generator
        </h1>
        <p className="max-w-xl text-muted-fg">
          Convert YouTube videos into searchable transcripts. Simple, fast and free.
        </p>
        <div className="w-full max-w-xl">
          <UrlForm />
        </div>
      </section>

      <section aria-labelledby="how-it-works" className="flex flex-col gap-4">
        <h2 id="how-it-works" className="text-lg font-semibold">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-md border border-border bg-surface p-4">
              <span className="text-xs font-medium text-primary">{index + 1}</span>
              <h3 className="mt-1 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-fg">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="features" aria-labelledby="features-heading" className="flex flex-col gap-4">
        <h2 id="features-heading" className="text-lg font-semibold">
          Features
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
