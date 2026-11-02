"""Domain errors that are safe to return to clients.

Anything not derived from AppError is treated as unexpected and answered with a
generic message so internals never leak (SECURITY.md §D).
"""


class AppError(Exception):
    code = "INTERNAL_ERROR"
    status_code = 500
    message = "Something went wrong. Please try again."


class InvalidUrlError(AppError):
    code = "INVALID_URL"
    status_code = 400
    message = "That is not a supported YouTube video URL."


class VideoNotFoundError(AppError):
    code = "VIDEO_NOT_FOUND"
    status_code = 404
    message = "This video could not be found. It may be private or removed."


class CaptionsUnavailableError(AppError):
    code = "CAPTIONS_UNAVAILABLE"
    status_code = 404
    message = "No captions are available for this video in the selected language."


class UpstreamBlockedError(AppError):
    code = "UPSTREAM_BLOCKED"
    status_code = 503
    message = "YouTube is temporarily refusing requests. Please try again shortly."


class UpstreamTimeoutError(AppError):
    code = "UPSTREAM_TIMEOUT"
    status_code = 504
    message = "YouTube took too long to respond. Please try again."
