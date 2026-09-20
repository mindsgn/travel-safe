from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class GeoPoint(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    label: str | None = None


class TripRequest(BaseModel):
    origin: GeoPoint
    destination: GeoPoint
    profile: Literal["walking", "driving"] = "driving"
    device_code: str | None = Field(default=None, min_length=4, max_length=64)


class LocationPing(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_meters: float | None = Field(default=None, ge=0)
    device_code: str | None = Field(default=None, min_length=4, max_length=64)


class DeviceRegistration(BaseModel):
    device_code: str = Field(min_length=4, max_length=64)
