"""HTML parsing for Daily Voice listing and article pages.

Selector / metadata strategy (inspected 2026-09-20):

1. Prefer JSON-LD ``NewsArticle`` for headline, authors, dates, keywords, image.
2. Prefer ``<link rel="canonical">`` then OpenGraph ``og:url``.
3. Prefer OpenGraph ``article:published_time`` / ``article:section`` when JSON-LD
   is incomplete. ``article:published_time`` on this site is a Unix millisecond
   timestamp, not an ISO string.
4. Fall back to semantic HTML:
   - title: ``h1``
   - author: ``[class*="author-text"] a``
   - body: ``p`` tags inside ``[class*="text_text__"]``. On the live site
     those nodes are nested under ``widgets_article-widgets``; that wrapper
     must not be stripped.
5. Listing URLs: ``a[href]`` whose path matches a dated article slug, typically
   ``a[class*="article-link"]``.

CSS module hashes (``article_content__Ag4R_``) can change; prefix matches are used.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from dailyvoice_scraper.dates import normalize_datetime
from dailyvoice_scraper.exceptions import ParseError
from dailyvoice_scraper.hashing import content_hash
from dailyvoice_scraper.models import Article
from dailyvoice_scraper.urls import is_article_url, normalize_url

logger = logging.getLogger(__name__)

NOISE_CLASS_HINTS = (
    "article-share",
    "cookie",
    "newsletter",
    "comment",
    "subscribe",
    "googlefollow",
    "ai-share",
    "navigation_",
    "footer_",
    "article_footer",
)

BODY_CLASS_RE = re.compile(r"text_text__")

ARTICLE_HREF_RE = re.compile(
    r"/(?:daily-voice/|capeargus/|weekend-argus/)?"
    r"(?:news|sport|opinion|lifestyle-entertainment)"
    r"(?:/(?!\d{4}-\d{2}-\d{2}-)[a-z0-9\-]+)*/"
    r"\d{4}-\d{2}-\d{2}-",
    re.I,
)


class DailyVoiceParser:
    def __init__(self, base_url: str = "https://dailyvoice.co.za", source_name: str = "Daily Voice") -> None:
        self.base_url = base_url.rstrip("/")
        self.source_name = source_name

    def parse_listing(self, html: str) -> list[str]:
        soup = BeautifulSoup(html, "html.parser")
        urls: list[str] = []
        seen: set[str] = set()
        for anchor in soup.find_all("a", href=True):
            href = str(anchor.get("href") or "")
            if not ARTICLE_HREF_RE.search(href):
                continue
            normalized = normalize_url(href, self.base_url)
            if not is_article_url(normalized):
                continue
            if normalized in seen:
                continue
            seen.add(normalized)
            urls.append(normalized)
        return urls

    def parse_sitemap(self, xml: str) -> list[str]:
        # html.parser is enough for <loc> tags and avoids an lxml dependency.
        soup = BeautifulSoup(xml, "html.parser")
        urls: list[str] = []
        seen: set[str] = set()
        for loc in soup.find_all("loc"):
            raw = loc.get_text(strip=True)
            normalized = normalize_url(raw, self.base_url)
            if not is_article_url(normalized) or normalized in seen:
                continue
            seen.add(normalized)
            urls.append(normalized)
        return urls

    def parse_article(self, html: str, url: str) -> Article:
        soup = BeautifulSoup(html, "html.parser")
        news = _first_newsarticle(_json_ld_blocks(soup))
        canonical = _canonical_url(soup, url, self.base_url)
        title = _text(news.get("headline") if news else None) or _og(soup, "og:title") or _h1(soup)
        if not title:
            raise ParseError(f"Missing title for {url}")

        body = _article_body(soup)
        if not body:
            raise ParseError(f"Missing article body for {url}")

        author = _authors(news) or _og(soup, "article:author") or _author_from_html(soup)
        published_raw = None
        published_iso = None
        if news and news.get("datePublished"):
            published_iso, published_raw = normalize_datetime(str(news["datePublished"]))
        if not published_iso:
            published_iso, published_raw = normalize_datetime(_og(soup, "article:published_time"))

        updated_iso, _updated_raw = normalize_datetime(
            str(news.get("dateModified")) if news and news.get("dateModified") else None
        )
        tags = _tags(news)
        category = _og(soup, "article:section") or _category_from_html(soup)
        subtitle = _text(news.get("description") if news else None) or _og(soup, "og:description")
        image_url = _image_url(news) or _og(soup, "og:image")

        return Article(
            source=self.source_name,
            source_url=normalize_url(url, self.base_url),
            canonical_url=canonical,
            title=title.strip(),
            subtitle=subtitle,
            author=author,
            published_at=published_iso,
            published_at_raw=published_raw,
            updated_at=updated_iso,
            category=category,
            tags=tags,
            location=None,
            article_text=body,
            image_url=image_url,
            content_hash=content_hash(title, body),
        )


def _json_ld_blocks(soup: BeautifulSoup) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.get_text() or ""
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Malformed JSON-LD ignored")
            continue
        if isinstance(data, list):
            blocks.extend(item for item in data if isinstance(item, dict))
        elif isinstance(data, dict):
            blocks.append(data)
    return blocks


def _first_newsarticle(blocks: list[dict[str, Any]]) -> dict[str, Any] | None:
    for block in blocks:
        types = block.get("@type")
        if types == "NewsArticle" or (isinstance(types, list) and "NewsArticle" in types):
            return block
    return None


def _canonical_url(soup: BeautifulSoup, fallback: str, base_url: str) -> str:
    link = soup.find("link", rel=lambda value: value and "canonical" in value)  # type: ignore[arg-type]
    href = link.get("href") if isinstance(link, Tag) else None
    og = _og(soup, "og:url")
    chosen = str(href or og or fallback)
    return normalize_url(chosen, base_url)


def _og(soup: BeautifulSoup, property_name: str) -> str | None:
    tag = soup.find("meta", attrs={"property": property_name}) or soup.find(
        "meta", attrs={"name": property_name}
    )
    if not isinstance(tag, Tag):
        return None
    content = tag.get("content")
    return str(content).strip() if content else None


def _h1(soup: BeautifulSoup) -> str | None:
    heading = soup.find("h1")
    if not heading:
        return None
    text = heading.get_text(" ", strip=True)
    return text or None


def _authors(news: dict[str, Any] | None) -> str | None:
    if not news:
        return None
    authors = news.get("author")
    names: list[str] = []
    if isinstance(authors, dict):
        name = _text(authors.get("name"))
        if name:
            names.append(name)
    elif isinstance(authors, list):
        for item in authors:
            if isinstance(item, dict):
                name = _text(item.get("name"))
            else:
                name = _text(item)
            if name and name not in names:
                names.append(name)
    elif isinstance(authors, str):
        names.append(authors)
    return ", ".join(names) if names else None


def _author_from_html(soup: BeautifulSoup) -> str | None:
    node = soup.find(class_=re.compile(r"author-text"))
    if not node:
        return None
    text = node.get_text(" ", strip=True)
    return text or None


def _tags(news: dict[str, Any] | None) -> str | None:
    if not news:
        return None
    keywords = news.get("keywords")
    if isinstance(keywords, str) and keywords.strip():
        return keywords.strip()
    if isinstance(keywords, list):
        values = [str(item).strip() for item in keywords if str(item).strip()]
        return ", ".join(values) if values else None
    return None


def _image_url(news: dict[str, Any] | None) -> str | None:
    if not news:
        return None
    image = news.get("image")
    if isinstance(image, str):
        return image
    if isinstance(image, list) and image:
        first = image[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return _text(first.get("url"))
    if isinstance(image, dict):
        return _text(image.get("url"))
    return None


def _category_from_html(soup: BeautifulSoup) -> str | None:
    node = soup.find(class_=re.compile(r"article-section"))
    if not node:
        return None
    text = node.get_text(" ", strip=True)
    return text or None


def _article_body(soup: BeautifulSoup) -> str:
    working = BeautifulSoup(str(soup), "html.parser")
    for tag in working.find_all(["script", "style", "noscript", "iframe", "svg", "form", "button", "nav", "aside"]):
        tag.decompose()
    for tag in working.find_all(True):
        if not isinstance(tag, Tag) or tag.attrs is None:
            continue
        class_value = tag.get("class") or []
        if isinstance(class_value, str):
            classes = class_value.lower()
        else:
            classes = " ".join(str(item) for item in class_value).lower()
        if any(hint in classes for hint in NOISE_CLASS_HINTS):
            tag.decompose()

    container = working.find(class_=re.compile(r"article_content__"))
    search_root = container if isinstance(container, Tag) else working
    body_nodes = search_root.find_all(class_=BODY_CLASS_RE)
    paragraph_roots = body_nodes if body_nodes else [search_root]
    paragraphs: list[str] = []
    seen: set[str] = set()
    for root in paragraph_roots:
        for paragraph in root.find_all("p"):
            text = paragraph.get_text(" ", strip=True)
            if _is_boilerplate_paragraph(text) or text in seen:
                continue
            seen.add(text)
            paragraphs.append(text)
    return "\n\n".join(paragraphs).strip()


def _is_boilerplate_paragraph(text: str) -> bool:
    if len(text) < 40:
        return True
    lowered = text.lower()
    if lowered in {"news", "sport", "subscribe", "load more"}:
        return True
    if "cookie" in lowered or "newsletter" in lowered:
        return True
    if lowered.startswith("related article"):
        return True
    return False


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def absolutize(url: str, base_url: str) -> str:
    return urljoin(base_url.rstrip("/") + "/", url)
