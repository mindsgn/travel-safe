"""Shared exception types."""


class ScraperError(Exception):
    """Base error for the scraper."""


class ConfigurationError(ScraperError):
    """Invalid or missing configuration."""


class ParseError(ScraperError):
    """Article or listing HTML could not be converted into structured data."""


class ValidationError(ScraperError):
    """Parsed article failed required-field validation."""


class HttpClientError(ScraperError):
    """Unrecoverable HTTP failure after retries."""
