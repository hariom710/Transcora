import logging
import requests

from youtube_transcript_api import (
    CouldNotRetrieveTranscript,
    InvalidVideoId,
    IpBlocked,
    NoTranscriptFound,
    NotTranslatable,
    PoTokenRequired,
    RequestBlocked,
    TranscriptsDisabled,
    TranslationLanguageNotAvailable,
    VideoUnavailable,
    YouTubeRequestFailed,
    YouTubeTranscriptApi,
)
import youtube_transcript_api._transcripts as _transcripts_module

from app.core.exceptions import (
    AppError,
    CaptionsUnavailableError,
    UpstreamBlockedError,
    VideoNotFoundError,
)
from app.services.providers.base import LanguageInfo, RawTranscript, Segment

logger = logging.getLogger("transcora.youtube")

# Client contexts tried in order when the default is blocked.
# Each uses a different Innertube client so YouTube's bot detection
# may allow one even when another is blocked. No proxies, cookies,
# or third-party APIs are used (ADR-004, SECURITY.md).
_CLIENT_CONTEXTS: tuple[tuple[str, dict], ...] = (
    ("WEB", {"client": {"clientName": "WEB", "clientVersion": "2.20251201.00.00"}}),
    ("ANDROID", {"client": {"clientName": "ANDROID", "clientVersion": "20.10.38"}}),
    ("IOS", {"client": {"clientName": "IOS", "clientVersion": "20.10.38"}}),
    ("TV", {"client": {"clientName": "TVHTML5", "clientVersion": "7.20250101"}}),
)

_CLIENT_USER_AGENTS: dict[str, str] = {
    "WEB": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "ANDROID": "com.google.android.youtube/20.10.38 (Linux; U; Android 13; en_US) gzip",
    "IOS": "com.google.ios.youtube/20.10.38 (iPhone14,3; U; CPU iOS 17_0 like Mac OS X)",
    "TV": "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) Version/6.0 Safari/537.36",
}

# Errors that indicate IP/client-level blocking and should trigger fallback.
_BLOCKED_ERRORS = (IpBlocked, RequestBlocked, PoTokenRequired)

# Ordered: the generic base class must come last so specific cases win.
_ERROR_MAP: tuple[tuple[type[Exception], type[AppError]], ...] = (
    (TranscriptsDisabled, CaptionsUnavailableError),
    (NoTranscriptFound, CaptionsUnavailableError),
    (VideoUnavailable, VideoNotFoundError),
    (InvalidVideoId, VideoNotFoundError),
    (IpBlocked, UpstreamBlockedError),
    (RequestBlocked, UpstreamBlockedError),
    (PoTokenRequired, UpstreamBlockedError),
    (YouTubeRequestFailed, UpstreamBlockedError),
    (CouldNotRetrieveTranscript, UpstreamBlockedError),
)


def _map_error(exc: Exception) -> AppError:
    for source, target in _ERROR_MAP:
        if isinstance(exc, source):
            return target()
    # Never let provider internals reach the client (SECURITY.md §D).
    return UpstreamBlockedError()


class YouTubeProvider:
    """Adapter over youtube-transcript-api, mapped onto our own error taxonomy."""

    def __init__(self) -> None:
        self._original_context = _transcripts_module.INNERTUBE_CONTEXT

    def _execute_with_client_fallback(self, operation):
        """Execute `operation(api)` trying each client context until one succeeds.

        Tries WEB -> ANDROID -> IOS -> TV in order. Each attempt uses a fresh
        requests.Session with a client-specific User-Agent and Innertube context.
        If all clients are blocked, re-raises the last blocking error so the
        caller's error mapper converts it to UPSTREAM_BLOCKED.

        Note: temporarily overrides the module-level INNERTUBE_CONTEXT.
        Not thread-safe if multiple requests share the same event loop;
        acceptable for single-worker deployments (documented shortcut).
        """
        last_error: Exception | None = None
        for client_name, context in _CLIENT_CONTEXTS:
            _transcripts_module.INNERTUBE_CONTEXT = context
            session = requests.Session()
            session.headers.update(
                {
                    "Accept-Language": "en-US",
                    "User-Agent": _CLIENT_USER_AGENTS[client_name],
                }
            )
            api = YouTubeTranscriptApi(http_client=session)
            try:
                logger.info("Trying YouTube client %s", client_name)
                result = operation(api)
                logger.info("YouTube client %s succeeded", client_name)
                return result
            except _BLOCKED_ERRORS as exc:
                logger.warning("YouTube client %s blocked: %s", client_name, exc)
                last_error = exc
                continue
        # Restore original context before raising
        _transcripts_module.INNERTUBE_CONTEXT = self._original_context
        if last_error is not None:
            raise last_error
        raise UpstreamBlockedError()  # Should not reach here

    def list_languages(self, video_id: str) -> list[LanguageInfo]:
        try:
            tracks = self._execute_with_client_fallback(
                lambda api: api.list(video_id)
            )
        except CouldNotRetrieveTranscript as exc:
            raise _map_error(exc) from exc

        # Manual tracks come first from the library; keep the first entry per code.
        seen: dict[str, LanguageInfo] = {}
        for track in tracks:
            seen.setdefault(
                track.language_code,
                LanguageInfo(
                    code=track.language_code,
                    name=track.language,
                    is_generated=track.is_generated,
                ),
            )
        return list(seen.values())

    def fetch(self, video_id: str, language: str | None = None) -> RawTranscript:
        try:
            fetched = self._execute_with_client_fallback(
                lambda api: self._fetch_with_api(api, video_id, language)
            )
        except CouldNotRetrieveTranscript as exc:
            raise _map_error(exc) from exc

        return RawTranscript(
            language=fetched.language,
            language_code=fetched.language_code,
            is_generated=fetched.is_generated,
            segments=[
                Segment(text=snippet.text, start=snippet.start, duration=snippet.duration)
                for snippet in fetched.snippets
            ],
        )

    @staticmethod
    def _fetch_with_api(api, video_id: str, language: str | None):
        tracks = api.list(video_id)
        track = YouTubeProvider._select(tracks, language)
        return track.fetch()

    @staticmethod
    def _select(tracks, language: str | None):
        if not language:
            # Library yields manual captions before auto-generated ones.
            return next(iter(tracks))
        try:
            return tracks.find_transcript([language])
        except NoTranscriptFound:
            pass
        # Fall back to a YouTube-provided translation when a track offers it.
        for track in tracks:
            if not track.is_translatable:
                continue
            try:
                return track.translate(language)
            except (
                NotTranslatable,
                TranslationLanguageNotAvailable,
                NoTranscriptFound,
            ):
                continue
        raise CaptionsUnavailableError()
