export const metadata = { title: "About — Transcora" };

export default function AboutPage() {
  return (
    <article className="prose-sm flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">About</h1>
      <p className="text-muted-fg">
        Transcora is a free YouTube transcript generator. Paste a video link and get the
        captions that already exist for that video as searchable, editable, downloadable text.
      </p>
      <h2 className="text-lg font-semibold">What it does</h2>
      <p className="text-muted-fg">
        It reads available caption tracks — both creator-provided and auto-generated — and
        renders them with timestamps. You can search, jump to a moment, edit the text and
        export TXT, SRT, VTT, Markdown or PDF.
      </p>
      <h2 className="text-lg font-semibold">What it does not do</h2>
      <p className="text-muted-fg">
        It does not transcribe audio. Videos without accessible captions cannot be processed,
        and private or restricted videos may be unavailable. YouTube may also limit automated
        requests.
      </p>
      <h2 className="text-lg font-semibold">Cost</h2>
      <p className="text-muted-fg">
        Free to use. No account, no subscription, no payment details.
      </p>
    </article>
  );
}
