"""Light text normalization. Does not rewrite meaning."""

from __future__ import annotations

import html
import re
import unicodedata

_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"[ \t\u00a0\u202f]+")
_NEWLINE_RE = re.compile(r"\n{3,}")
_INVISIBLE_RE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060\ufeff]")
_PUNCT_STRIP_RE = re.compile(r"^[\W_]+|[\W_]+$", re.UNICODE)


def normalize_unicode(text: str) -> str:
    return unicodedata.normalize("NFKC", text)


def strip_html_artifacts(text: str) -> str:
    unescaped = html.unescape(text)
    without_tags = _TAG_RE.sub(" ", unescaped)
    return without_tags.replace("&nbsp;", " ")


def normalize_whitespace(text: str) -> str:
    collapsed = _WHITESPACE_RE.sub(" ", text)
    collapsed = _NEWLINE_RE.sub("\n\n", collapsed)
    lines = [line.strip() for line in collapsed.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def normalize_text(text: str | None) -> str:
    if not text:
        return ""
    value = normalize_unicode(text)
    value = _INVISIBLE_RE.sub("", value)
    value = strip_html_artifacts(value)
    return normalize_whitespace(value)


def normalize_title(title: str | None) -> str:
    value = normalize_text(title).lower()
    value = _PUNCT_STRIP_RE.sub("", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def description_excerpt(text: str, max_sentences: int = 2) -> str | None:
    if not text:
        return None
    parts = re.split(r"(?<=[.!?])\s+", text)
    excerpt = " ".join(parts[:max_sentences]).strip()
    return excerpt or None
