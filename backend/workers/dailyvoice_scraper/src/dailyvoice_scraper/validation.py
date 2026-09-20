"""Required-field checks. Optional fields stay None; they are not invented."""

from __future__ import annotations

from urllib.parse import urlsplit

from dailyvoice_scraper.exceptions import ValidationError
from dailyvoice_scraper.models import Article


def validate_article(article: Article) -> None:
    if not (article.title or "").strip():
        raise ValidationError("title must not be empty")
    if not (article.article_text or "").strip():
        raise ValidationError("article_text must not be empty")
    if not (article.content_hash or "").strip():
        raise ValidationError("content_hash must be present")
    canonical = article.canonical_url or article.source_url
    if not _looks_like_http_url(canonical):
        raise ValidationError("canonical_url must be a valid http(s) URL")


def _looks_like_http_url(url: str | None) -> bool:
    if not url:
        return False
    parts = urlsplit(url)
    return parts.scheme in {"http", "https"} and bool(parts.netloc)
