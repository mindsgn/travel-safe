"""HTTP client with delay, retries, and conservative error handling.

Does not use concurrent requests. Does not bypass CAPTCHA, Cloudflare
challenges, authentication, or paywalls.
"""

from __future__ import annotations

import logging
import random
import time
from dataclasses import dataclass
from typing import Callable

import requests

from dailyvoice_scraper.exceptions import HttpClientError

logger = logging.getLogger(__name__)

RetryAfterParser = Callable[[str | None], float | None]


@dataclass
class HttpResponse:
    url: str
    status_code: int
    text: str
    headers: dict[str, str]


class HttpClient:
    def __init__(
        self,
        *,
        user_agent: str,
        timeout_seconds: float = 20,
        max_retries: int = 3,
        request_delay_seconds: float = 2,
        session: requests.Session | None = None,
        sleeper: Callable[[float], None] | None = None,
    ) -> None:
        self.user_agent = user_agent
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.request_delay_seconds = request_delay_seconds
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": user_agent, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"})
        self._sleeper = sleeper or time.sleep
        self._last_request_at: float | None = None

    def get(self, url: str) -> HttpResponse | None:
        """GET a URL. Returns None for skippable client errors; raises after exhausted retries."""
        self._respect_delay()
        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                response = self.session.get(url, timeout=self.timeout_seconds, allow_redirects=True)
            except requests.Timeout as exc:
                last_error = exc
                logger.warning("Timeout fetching %s (attempt %s/%s)", url, attempt, self.max_retries)
                self._backoff(attempt)
                continue
            except requests.RequestException as exc:
                last_error = exc
                logger.warning("Connection error fetching %s: %s", url, exc)
                self._backoff(attempt)
                continue

            status = response.status_code
            if status == 200:
                return HttpResponse(
                    url=response.url,
                    status_code=status,
                    text=response.text,
                    headers={k.lower(): v for k, v in response.headers.items()},
                )
            if status in {301, 302, 303, 307, 308}:
                # requests follows redirects; if we still see these, treat as skip.
                logger.warning("Unresolved redirect %s for %s", status, url)
                return None
            if status == 404:
                logger.warning("404 for %s", url)
                return None
            if status == 429:
                retry_after = _retry_after_seconds(
                    response.headers.get("Retry-After") or response.headers.get("retry-after")
                )
                wait_for = self._backoff_seconds(attempt) if retry_after is None else retry_after
                logger.warning("429 for %s; waiting %.1fs", url, wait_for)
                self._sleeper(wait_for)
                continue
            if status in {500, 502, 503, 504}:
                logger.warning("Server error %s for %s (attempt %s/%s)", status, url, attempt, self.max_retries)
                self._backoff(attempt)
                continue
            if 400 <= status < 500:
                logger.warning("HTTP %s for %s; skipping", status, url)
                return None
            logger.warning("Unexpected HTTP %s for %s", status, url)
            return None

        raise HttpClientError(f"Failed to fetch {url} after {self.max_retries} attempts: {last_error}")

    def _respect_delay(self) -> None:
        if self.request_delay_seconds <= 0:
            self._last_request_at = time.monotonic()
            return
        now = time.monotonic()
        if self._last_request_at is not None:
            elapsed = now - self._last_request_at
            remaining = self.request_delay_seconds - elapsed
            if remaining > 0:
                self._sleeper(remaining)
        self._last_request_at = time.monotonic()

    def _backoff(self, attempt: int) -> None:
        self._sleeper(self._backoff_seconds(attempt))

    def _backoff_seconds(self, attempt: int) -> float:
        return min(30.0, (2 ** (attempt - 1)) + random.random())


def _retry_after_seconds(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        return None
