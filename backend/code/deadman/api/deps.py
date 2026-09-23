from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Header, Request

from deadman.accounts import authenticate
from deadman.config import Settings
from deadman.db import open_connection
from deadman.errors import AuthError


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_now(request: Request) -> datetime:
    return request.app.state.clock()


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    # One connection per request: sqlite3 connections must not share transactions across threads.
    connection = open_connection(request.app.state.settings.db_path)
    try:
        yield connection
    finally:
        connection.close()


def bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization:
        raise AuthError("missing_token")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AuthError("invalid_authorization_header")
    return token.strip()


Db = Annotated[sqlite3.Connection, Depends(get_db)]
Now = Annotated[datetime, Depends(get_now)]
AppSettings = Annotated[Settings, Depends(get_settings)]
Token = Annotated[str, Depends(bearer_token)]


def current_user(db: Db, now: Now, token: Token) -> str:
    return authenticate(db, access_token=token, now=now)


UserId = Annotated[str, Depends(current_user)]
