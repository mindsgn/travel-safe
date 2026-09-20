"""Hashing helpers for content-level deduplication."""

from __future__ import annotations

import hashlib
import re


_WHITESPACE = re.compile(r"\s+")


def content_hash(title: str, article_text: str) -> str:
    normalized = _WHITESPACE.sub(" ", f"{title.strip()}\n{article_text.strip()}".lower()).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
