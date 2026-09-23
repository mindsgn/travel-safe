from __future__ import annotations


class DomainError(Exception):
    status_code = 400

    def __init__(self, code: str, message: str | None = None, field: str | None = None) -> None:
        super().__init__(message or code)
        self.code = code
        self.message = message or code
        self.field = field


class AuthError(DomainError):
    status_code = 401


class NotFoundError(DomainError):
    status_code = 404


class ConflictError(DomainError):
    status_code = 409


class ValidationFailed(DomainError):
    status_code = 422
