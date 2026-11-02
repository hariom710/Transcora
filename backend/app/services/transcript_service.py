from app.schemas.transcript import LanguageList, Transcript, TranscriptSegment
from app.services.providers.base import LanguageInfo
from app.services.providers.youtube_provider import YouTubeProvider
from app.services.runner import run_blocking
from app.utils.url_parser import parse_video_id

provider = YouTubeProvider()


def _clean(text: str) -> str:
    return " ".join(text.split())


async def extract(url: str, language: str | None = None) -> Transcript:
    video_id = parse_video_id(url)
    raw = await run_blocking(provider.fetch, video_id, language)

    segments: list[TranscriptSegment] = []
    for snippet in raw.segments:
        text = _clean(snippet.text)
        if not text:
            continue
        segments.append(
            TranscriptSegment(
                id=len(segments) + 1, start=snippet.start, duration=snippet.duration, text=text
            )
        )

    return Transcript(
        video_id=video_id,
        language=raw.language,
        language_code=raw.language_code,
        is_generated=raw.is_generated,
        segments=segments,
    )


async def languages(video_id: str) -> LanguageList:
    found: list[LanguageInfo] = await run_blocking(provider.list_languages, video_id)
    return LanguageList(
        video_id=video_id,
        languages=[
            {"code": item.code, "name": item.name, "is_generated": item.is_generated}
            for item in found
        ],
    )
