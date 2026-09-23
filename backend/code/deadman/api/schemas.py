from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field

from deadman.accounts import TokenPair
from deadman.locations import LocationPoint


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    check_in_interval_days: int = Field(ge=1, le=365)
    timezone: str | None = Field(default=None, max_length=64)


class LoginRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    account_key: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    access_expires_at: datetime
    refresh_expires_at: datetime
    token_type: Literal["bearer"] = "bearer"

    @classmethod
    def from_pair(cls, pair: TokenPair) -> TokenResponse:
        return cls(
            access_token=pair.access_token,
            refresh_token=pair.refresh_token,
            access_expires_at=pair.access_expires_at,
            refresh_expires_at=pair.refresh_expires_at,
        )


class RegisterResponse(BaseModel):
    user_id: str
    account_key: str
    tokens: TokenResponse


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None, max_length=64)
    check_in_interval_days: int | None = Field(default=None, ge=1, le=365)


class ContactPayload(BaseModel):
    name: str = Field(max_length=100)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=32)
    whatsapp: bool = False


class LocationPayload(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0, le=100_000)
    recorded_at: AwareDatetime

    def to_point(self) -> LocationPoint:
        return LocationPoint(self.latitude, self.longitude, self.accuracy_m, self.recorded_at)


class DevicePayload(BaseModel):
    battery_level: float | None = Field(default=None, ge=0, le=1)
    low_power_mode: bool | None = None


class CheckInRequest(BaseModel):
    client_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    occurred_at: AwareDatetime
    location: LocationPayload | None = None
    device: DevicePayload | None = None


class LocationBatch(BaseModel):
    points: list[LocationPayload] = Field(min_length=1, max_length=100)
    source: Literal["foreground", "background"] = "foreground"
    device: DevicePayload | None = None
