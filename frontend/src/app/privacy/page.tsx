export const metadata = { title: "Privacy — Transcora" };

const PRINCIPLES = [
  {
    title: "No account",
    body: "There is no registration and no login, so we never hold personal details.",
  },
  {
    title: "No transcript storage by default",
    body: "Transcripts stay in your browser — in page memory and, if you save them, in this browser's local library (IndexedDB). They are not written to a server database unless you explicitly publish one as a shareable link.",
  },
  {
    title: "Shareable links are public",
    body: "When you create a share link, that one transcript is stored on our server so anyone with the link can read it. It expires automatically after 30 days, and a one-time delete token (shown once at creation) removes it immediately. We store only a hash of the link token and the transcript itself — no account, no creator identity. Creation is rate-limited and share pages are excluded from search engines.",
  },
  {
    title: "Embedded video player",
    body: "The transcript workspace embeds YouTube's player, which connects to YouTube when the page opens. What you play is between you and YouTube — Transcora never sees it.",
  },
  {
    title: "No URL retention",
    body: "Submitted URLs are used to answer your request and are not kept afterwards.",
  },
  {
    title: "Minimal logging",
    body: "Server logs record metadata such as status codes — not full transcript contents.",
  },
  {
    title: "No API keys of ours",
    body: "The core product uses no third-party API keys. Optional AI features use your own Gemini key, which stays in your browser and is sent only to Google's API — never to our servers.",
  },
];

export default function PrivacyPage() {
  return (
    <article className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-title font-semibold">Privacy</h1>
      <p className="text-body-sm text-muted-fg">
        Transcora extracts existing YouTube captions. It does not transcribe audio and it does
        not require an account.
      </p>
      <ul className="flex flex-col gap-3">
        {PRINCIPLES.map((item) => (
          <li key={item.title} className="card p-4">
            <h2 className="text-body-sm font-semibold">{item.title}</h2>
            <p className="mt-1 text-body-sm text-muted-fg">{item.body}</p>
          </li>
        ))}
      </ul>
      <p className="text-body-sm text-muted-fg">
        AI features are optional and off until you add a free Gemini key. The key is kept in this
        browser only (session-only by default, or remembered if you opt in with a visible
        &quot;Forget key&quot; action) and is sent directly to Google&apos;s API — it never reaches
        our servers.
      </p>
    </article>
  );
}
