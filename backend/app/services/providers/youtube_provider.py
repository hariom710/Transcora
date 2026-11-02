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

from app.core.exceptions import (
    AppError,
    CaptionsUnavailableError,
    UpstreamBlockedError,
    VideoNotFoundError,
)
from app.services.providers.base import LanguageInfo, RawTranscript, Segment

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

    def list_languages(self, video_id: str) -> list[LanguageInfo]:
        try:
            tracks = list(YouTubeTranscriptApi().list(video_id))
        except CouldNotRetrieveTranscript as exc:
            raise _map_error(exc) from exc

        # Manual tracks come first from the library; keep the first entry per code.
        seen: dict[str, LanguageInfo] = {}
        for track in tracks:
            seen.setdefault(
                track.language_code,
                LanguageInfo(
                    code=track.language_code, name=track.language, is_generated=track.is_generated
                ),
            )
        return list(seen.values())

    def fetch(self, video_id: str, language: str | None = None) -> RawTranscript:
        try:
            tracks = YouTubeTranscriptApi().list(video_id)
            track = self._select(tracks, language)
            fetched = track.fetch()
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
            except (NotTranslatable, TranslationLanguageNotAvailable, NoTranscriptFound):
                continue
        raise CaptionsUnavailableError()
