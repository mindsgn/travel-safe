from pathlib import Path

import pytest

from dailyvoice_scraper.exceptions import ParseError
from dailyvoice_scraper.parser import DailyVoiceParser

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def parser() -> DailyVoiceParser:
    return DailyVoiceParser()


def test_parse_listing_extracts_article_urls(parser: DailyVoiceParser) -> None:
    html = (FIXTURES / "listing.html").read_text(encoding="utf-8")
    urls = parser.parse_listing(html)
    assert "https://dailyvoice.co.za/news/2026-09-20-gunned-down-after-turning-life-around/" in urls
    assert (
        "https://dailyvoice.co.za/news/western-cape/2026-09-20-body-hidden-under-coffin-police-probe-paarl-undertakers-alleged-irregularities/"
        in urls
    )


def test_parse_listing_handles_relative_urls(parser: DailyVoiceParser) -> None:
    html = (FIXTURES / "listing.html").read_text(encoding="utf-8")
    urls = parser.parse_listing(html)
    assert all(url.startswith("https://dailyvoice.co.za/") for url in urls)


def test_parse_listing_removes_duplicate_urls(parser: DailyVoiceParser) -> None:
    html = (FIXTURES / "listing.html").read_text(encoding="utf-8")
    urls = parser.parse_listing(html)
    assert len(urls) == len(set(urls))
    assert len(urls) == 2


def test_parse_article_extracts_title(parser: DailyVoiceParser) -> None:
    html = (FIXTURES / "article.html").read_text(encoding="utf-8")
    article = parser.parse_article(html, "https://dailyvoice.co.za/news/2026-09-20-gunned-down-after-turning-life-around/")
    assert article.title == "Gunned down after turning life around"


def test_parse_article_extracts_author(parser: DailyVoiceParser) -> None:
    html = (FIXTURES / "article.html").read_text(encoding="utf-8")
    article = parser.parse_article(html, "https://dailyvoice.co.za/news/2026-09-20-gunned-down-after-turning-life-around/")
    assert article.author == "Marsha Dean"


def test_parse_article_extracts_date(parser: DailyVoiceParser) -> None:
    html = (FIXTURES / "article.html").read_text(encoding="utf-8")
    article = parser.parse_article(html, "https://dailyvoice.co.za/news/2026-09-20-gunned-down-after-turning-life-around/")
    assert article.published_at is not None
    assert article.published_at.startswith("2026-09-20")


def test_parse_article_extracts_body(parser: DailyVoiceParser) -> None:
    html = (FIXTURES / "article.html").read_text(encoding="utf-8")
    article = parser.parse_article(html, "https://dailyvoice.co.za/news/2026-09-20-gunned-down-after-turning-life-around/")
    assert "shot dead" in article.article_text
    assert "Related article widget" not in article.article_text
    assert "Subscribe to our newsletter" not in article.article_text
    assert "\n\n" in article.article_text


def test_parse_article_extracts_canonical_url(parser: DailyVoiceParser) -> None:
    html = (FIXTURES / "article.html").read_text(encoding="utf-8")
    article = parser.parse_article(
        html,
        "https://dailyvoice.co.za/daily-voice/news/2026-09-20-gunned-down-after-turning-life-around/?utm_source=x",
    )
    assert article.canonical_url == "https://dailyvoice.co.za/news/2026-09-20-gunned-down-after-turning-life-around/"


def test_parse_article_handles_missing_author(parser: DailyVoiceParser) -> None:
    html = """
    <html><head>
      <link rel="canonical" href="https://dailyvoice.co.za/news/2026-09-20-example-story/"/>
      <script type="application/ld+json">
      {"@type":"NewsArticle","headline":"Example story","datePublished":"2026-09-20T10:00:00+0000"}
      </script>
    </head>
    <body>
      <h1>Example story</h1>
      <div class="article_content__Ag4R_">
        <p>The police said a suspect was arrested after the robbery occurred in Delft on Friday evening.</p>
      </div>
    </body></html>
    """
    article = parser.parse_article(html, "https://dailyvoice.co.za/news/2026-09-20-example-story/")
    assert article.author is None
    assert article.title == "Example story"


def test_parse_article_handles_missing_optional_fields(parser: DailyVoiceParser) -> None:
    html = """
    <html><head><title>Only the essentials</title></head>
    <body>
      <h1>Only the essentials</h1>
      <div class="article_content__Ag4R_">
        <p>This paragraph is long enough to count as article body text for the parser tests.</p>
      </div>
    </body></html>
    """
    article = parser.parse_article(html, "https://dailyvoice.co.za/news/2026-09-20-only-the-essentials/")
    assert article.published_at is None
    assert article.author is None
    assert article.tags is None


def test_parse_malformed_article(parser: DailyVoiceParser) -> None:
    html = (FIXTURES / "malformed_article.html").read_text(encoding="utf-8")
    with pytest.raises(ParseError):
        parser.parse_article(html, "https://dailyvoice.co.za/news/2026-09-20-broken/")
