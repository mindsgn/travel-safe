from unittest.mock import MagicMock

import pytest
import requests

from dailyvoice_scraper.exceptions import HttpClientError
from dailyvoice_scraper.http_client import HttpClient


def _response(status_code: int, text: str = "ok", headers: dict[str, str] | None = None, url: str = "https://dailyvoice.co.za/news/") -> MagicMock:
    response = MagicMock()
    response.status_code = status_code
    response.text = text
    response.url = url
    response.headers = headers or {}
    return response


def test_successful_request() -> None:
    session = MagicMock()
    session.headers = {}
    session.get.return_value = _response(200, "hello")
    client = HttpClient(user_agent="test-bot", request_delay_seconds=0, session=session, sleeper=lambda _: None)
    result = client.get("https://dailyvoice.co.za/news/")
    assert result is not None
    assert result.status_code == 200
    assert result.text == "hello"


def test_timeout() -> None:
    session = MagicMock()
    session.headers = {}
    session.get.side_effect = requests.Timeout("timed out")
    client = HttpClient(
        user_agent="test-bot",
        request_delay_seconds=0,
        max_retries=2,
        session=session,
        sleeper=lambda _: None,
    )
    with pytest.raises(HttpClientError):
        client.get("https://dailyvoice.co.za/news/")
    assert session.get.call_count == 2


def test_404() -> None:
    session = MagicMock()
    session.headers = {}
    session.get.return_value = _response(404, "missing")
    client = HttpClient(user_agent="test-bot", request_delay_seconds=0, session=session, sleeper=lambda _: None)
    assert client.get("https://dailyvoice.co.za/news/missing/") is None


def test_429() -> None:
    session = MagicMock()
    session.headers = {}
    session.get.side_effect = [
        _response(429, "slow down", headers={"Retry-After": "0"}),
        _response(200, "ok"),
    ]
    sleeps: list[float] = []
    client = HttpClient(
        user_agent="test-bot",
        request_delay_seconds=0,
        session=session,
        sleeper=sleeps.append,
    )
    result = client.get("https://dailyvoice.co.za/news/")
    assert result is not None
    assert result.status_code == 200
    assert sleeps == [0.0]


def test_server_error_retry() -> None:
    session = MagicMock()
    session.headers = {}
    session.get.side_effect = [
        _response(503, "unavailable"),
        _response(200, "ok"),
    ]
    client = HttpClient(
        user_agent="test-bot",
        request_delay_seconds=0,
        session=session,
        sleeper=lambda _: None,
    )
    result = client.get("https://dailyvoice.co.za/news/")
    assert result is not None
    assert result.status_code == 200
    assert session.get.call_count == 2
