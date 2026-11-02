export const metadata = { title: "Privacy — Transcora" };

const PRINCIPLES = [
  {
    title: "No account",
    body: "There is no registration and no login, so we never hold personal details.",
  },
  {
    title: "No transcript storage",
    body: "Transcripts stay in your browser. They are not written to a database.",
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
    title: "No API keys in Version 1",
    body: "The core product stores no third-party API keys.",
  },
];

export default function PrivacyPage() {
  return (
    <article className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Privacy</h1>
      <p className="text-muted-fg">
        Transcora extracts existing YouTube captions. It does not transcribe audio and it does
        not require an account.
      </p>
      <ul className="flex flex-col gap-3">
        {PRINCIPLES.map((item) => (
          <li key={item.title} className="rounded-md border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-fg">{item.body}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-fg">
        Optional AI features planned for a later version will use your own API key, handled in
        your browser. That key would never be sent to our servers.
      </p>
    </article>
  );
}
