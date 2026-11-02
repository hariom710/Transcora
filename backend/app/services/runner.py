import asyncio

from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.exceptions import UpstreamTimeoutError


async def run_blocking(fn, *args):
    """Run provider work off the event loop with a bounded response time.

    shortcut: on timeout the worker thread keeps running until the upstream call
    finishes; replace with a cancellable client if timeouts pile up under load.
    """
    try:
        return await asyncio.wait_for(
            run_in_threadpool(fn, *args), timeout=settings.request_timeout_seconds
        )
    except TimeoutError as exc:
        raise UpstreamTimeoutError() from exc
