// shortcut: switch to the production frontend origin once T6 deploys;
// until then the extension opens the local dev server.
const APP_ORIGIN = "http://localhost:3000";

const statusEl = document.getElementById("status");
const buttonEl = document.getElementById("open");

// Same accepted shapes as src/lib/url.ts: watch?v=, youtu.be/, /shorts/, /embed/.
function videoIdOf(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return /^[A-Za-z0-9_-]{11}$/.test(parsed.pathname.slice(1)) ? parsed.pathname.slice(1) : null;
    }
    if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") {
      return null;
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    const id = parts[0] === "watch" ? parsed.searchParams.get("v") : parts[1];
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const videoId = tab?.url ? videoIdOf(tab.url) : null;
  if (!videoId) {
    statusEl.textContent = "Open a YouTube video first.";
    return;
  }
  statusEl.textContent = "This video can be opened in Transcora.";
  buttonEl.disabled = false;
  buttonEl.addEventListener("click", () => {
    // The page URL travels only as a query parameter to our own app —
    // the extension never fetches anything itself (SECURITY.md §B).
    chrome.tabs.create({
      url: `${APP_ORIGIN}/transcript?url=${encodeURIComponent(tab.url)}`,
    });
    window.close();
  });
});
