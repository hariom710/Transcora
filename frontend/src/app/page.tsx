import { UrlForm } from "@/components/url-input/url-form";

const FEATURES = [
  {
    title: "Timestamped transcript",
    body: "Every line keeps its timestamp, and each one links straight to that moment in the video.",
  },
  {
    title: "Instant search",
    body: "Find any sentence, highlight every match and jump between results with one click.",
  },
  {
    title: "Edit before export",
    body: "Fix a word or clean up formatting — your edits carry into every downloaded file.",
  },
  {
    title: "All caption types",
    body: "Creator-provided and auto-generated captions, with the type clearly labelled.",
  },
  {
    title: "Language selection",
    body: "Pick from the caption languages a video offers, including translated tracks.",
  },
  {
    title: "Free, no account",
    body: "No sign-up, no subscription, no tracking. Paste a link and start reading.",
  },
];

const STEPS = [
  { title: "Paste URL", body: "Drop in any YouTube video link." },
  { title: "Get transcript", body: "Available captions arrive in seconds." },
  { title: "Export", body: "Download or copy in the format you need." },
];

const FORMATS = ["TXT", "SRT", "VTT", "MD", "CSV", "DOCX", "PDF"];

const FAQ = [
  {
    q: "Does this transcribe audio?",
    a: "No. Transcora extracts caption tracks that already exist on the video. If a video has no accessible captions, there is nothing to extract — it does not listen to audio.",
  },
  {
    q: "Is it really free?",
    a: "Yes. There is no account, no subscription and no payment details, and every export format is free to use.",
  },
  {
    q: "Which YouTube links work?",
    a: "Watch links, youtu.be short links, embed links and Shorts all work. The URL is validated in your browser and again on the server.",
  },
  {
    q: "What can I do with a transcript?",
    a: "Search it, jump to timestamps, edit the text, copy it to the clipboard, and export TXT, SRT, VTT, Markdown, CSV, DOCX or PDF.",
  },
  {
    q: "Are my transcripts stored?",
    a: "No. Transcripts stay in your browser tab and are never written to a database. See the Privacy page for details.",
  },
];

const PREVIEW_ROWS = [
  { time: "00:00", text: "Welcome to today's programming tutorial." },
  { time: "00:05", text: "Today we will learn Python fundamentals." },
  { time: "00:12", text: "Let's start with variables and data types." },
  { time: "00:25", text: "Variables are used to store values." },
  { time: "00:40", text: "Now let's understand conditional statements." },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-20 sm:gap-28">
      {/* 1–3. Hero with the URL form */}
      <section className="flex flex-col items-center gap-6 pt-6 text-center sm:pt-14">
        <span className="rounded-full border border-border bg-surface px-3 py-1 text-caption text-muted-fg">
          Free · No account required
        </span>
        <h1 className="max-w-3xl text-display-sm font-semibold">YouTube Transcript Generator</h1>
        <p className="max-w-xl text-body text-muted-fg">
          Convert YouTube videos into searchable, editable, downloadable transcripts. Simple, fast
          and free.
        </p>
        <div className="w-full max-w-xl">
          <UrlForm />
        </div>
      </section>

      {/* 4. Product preview — static illustration of the workspace */}
      <section aria-label="Product preview" className="mx-auto w-full max-w-3xl">
        <div className="card select-none overflow-hidden shadow-md">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="h-10 w-16 shrink-0 rounded-md bg-muted" />
            <div className="min-w-0">
              <p className="truncate text-caption font-medium">Python Programming Tutorial</p>
              <p className="truncate text-caption text-muted-fg">Example channel · 15:30</p>
            </div>
            <span className="ml-auto hidden rounded-full border border-border px-2.5 py-1 text-caption text-muted-fg sm:inline">
              Manual captions
            </span>
          </div>
          <div className="divide-y divide-border" aria-hidden="true">
            {PREVIEW_ROWS.map((row) => (
              <div key={row.time} className="flex gap-4 px-5 py-3">
                <span className="w-12 shrink-0 font-mono text-caption text-muted-fg">
                  {row.time}
                </span>
                <span className="text-body-sm">{row.text}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4">
            {FORMATS.map((format) => (
              <span
                key={format}
                className="rounded-full border border-border bg-background px-3 py-1 text-caption font-medium"
              >
                {format}
              </span>
            ))}
            <span className="ml-auto text-caption text-muted-fg">487 words · 2029 characters</span>
          </div>
        </div>
      </section>

      {/* 5. Main features */}
      <section id="features" aria-labelledby="features-heading" className="flex flex-col gap-6">
        <div className="max-w-2xl">
          <h2 id="features-heading" className="text-title font-semibold">
            Everything you need to work with captions
          </h2>
          <p className="mt-2 text-body text-muted-fg">
            The transcript is the product — every feature exists to help you read, find and reuse it.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="card p-5">
              <h3 className="text-body-sm font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-body-sm text-muted-fg">{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 6. How it works */}
      <section aria-labelledby="how-it-works" className="flex flex-col gap-6">
        <h2 id="how-it-works" className="text-title font-semibold">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card p-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-caption font-medium text-primary-fg">
                {index + 1}
              </span>
              <h3 className="mt-3 text-body-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-body-sm text-muted-fg">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 7. Export formats */}
      <section aria-labelledby="exports-heading" className="flex flex-col gap-4">
        <h2 id="exports-heading" className="text-title font-semibold">
          Export anywhere
        </h2>
        <p className="max-w-2xl text-body text-muted-fg">
          Download in the format your workflow needs, or copy everything to the clipboard. Original
          timestamps are preserved and your edits are included.
        </p>
        <ul className="flex flex-wrap gap-2">
          {FORMATS.concat(["Copy to clipboard"]).map((format) => (
            <li
              key={format}
              className="rounded-full border border-border bg-surface px-4 py-1.5 text-caption font-medium"
            >
              {format}
            </li>
          ))}
        </ul>
      </section>

      {/* 8. FAQ */}
      <section aria-labelledby="faq-heading" className="flex flex-col gap-6">
        <h2 id="faq-heading" className="text-title font-semibold">
          Frequently asked questions
        </h2>
        <div className="flex max-w-3xl flex-col gap-3">
          {FAQ.map((item) => (
            <details key={item.q} className="faq card group px-5">
              <summary className="flex items-center justify-between gap-4 py-4 text-body-sm font-medium">
                {item.q}
                <span
                  aria-hidden="true"
                  className="faq-plus shrink-0 text-lg font-light text-muted-fg"
                >
                  +
                </span>
              </summary>
              <p className="pb-4 text-body-sm text-muted-fg">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 9. Final call to action */}
      <section aria-labelledby="cta-heading" className="card flex flex-col items-center gap-5 p-8 text-center sm:p-12">
        <h2 id="cta-heading" className="text-title font-semibold">
          Ready to read instead of watch?
        </h2>
        <p className="max-w-lg text-body text-muted-fg">
          Paste a YouTube link and get a searchable transcript in seconds.
        </p>
        <div className="w-full max-w-xl">
          <UrlForm id="cta-url" />
        </div>
      </section>
    </div>
  );
}
