"""URL normalization for Daily Voice article links."""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

TRACKING_QUERY_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "gclid",
    "fbclid",
    "mc_cid",
    "mc_eid",
}

# Public article pages live under /news/... even when sitemaps use /daily-voice/news/...
_BRAND_PREFIXES = ("/daily-voice", "/capeargus", "/weekend-argus")


def normalize_url(url: str, base_url: str = "https://dailyvoice.co.za") -> str:
    """Resolve relative URLs, drop fragments/tracking params, collapse trailing slash."""
    if not url:
        return ""
    joined = urljoin(base_url.rstrip("/") + "/", url.strip())
    parts = urlsplit(joined)
    path = _normalize_path(parts.path)
    query = _strip_tracking(parts.query)
    cleaned = urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, query, ""))
    return cleaned


def _normalize_path(path: str) -> str:
    if not path:
        return "/"
    for prefix in _BRAND_PREFIXES:
        if path == prefix or path.startswith(prefix + "/"):
            path = path[len(prefix) :] or "/"
            break
    if not path.startswith("/"):
        path = "/" + path
    if path != "/" and not path.endswith("/"):
        path += "/"
    return path


def _strip_tracking(query: str) -> str:
    if not query:
        return ""
    kept = [
        (key, value)
        for key, value in parse_qsl(query, keep_blank_values=True)
        if key.lower() not in TRACKING_QUERY_PARAMS
    ]
    return urlencode(kept)


def is_article_url(url: str) -> bool:
    """True when the path looks like a dated Daily Voice article, not a section index."""
    path = urlsplit(url).path.lower()
    # /news/2026-09-20-slug/ or /news/western-cape/2026-09-20-slug/
    parts = [part for part in path.split("/") if part]
    if not parts or parts[0] not in {"news", "sport", "lifestyle-entertainment", "opinion"}:
        return False
    for part in parts[1:]:
        if len(part) >= 11 and part[4] == "-" and part[7] == "-" and part[:4].isdigit():
            return True
    return False
