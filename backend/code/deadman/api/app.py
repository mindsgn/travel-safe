from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from deadman.api import public, routes
from deadman.config import Settings
from deadman.db import connect
from deadman.errors import DomainError
from deadman.timeutil import Clock, utc_now


def create_app(settings: Settings | None = None, clock: Clock = utc_now) -> FastAPI:
    settings = settings or Settings.from_env()
    connect(settings.db_path).close()  # apply migrations once at startup

    app = FastAPI(title="Deadman Switch API", version="1.0.0")
    app.state.settings = settings
    app.state.clock = clock
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
        )

    @app.exception_handler(DomainError)
    def handle_domain_error(_request: Request, error: DomainError) -> JSONResponse:
        headers = {"WWW-Authenticate": "Bearer"} if error.status_code == 401 else None
        return JSONResponse(
            {"error": {"code": error.code, "message": error.message, "field": error.field}},
            status_code=error.status_code,
            headers=headers,
        )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(routes.router)
    app.include_router(public.router)
    return app
