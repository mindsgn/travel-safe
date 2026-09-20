from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from travel_safe.database import (
    connect,
    count_location_pings,
    save_location,
    save_trip,
    upsert_device,
)
from travel_safe.heatmap import heatmap_along_pathway, heatmap_around_location
from travel_safe.models import DeviceRegistration, GeoPoint, LocationPing, TripRequest
from travel_safe.routing import LatLng, plan_road_pathway


def create_app(db_path: str | None = None) -> FastAPI:
    resolved_path = db_path or os.environ.get("TRAVEL_SAFE_DB", "travel_safe.db")
    connection = connect(resolved_path)

    app = FastAPI(title="Travel Safe API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.db_path = resolved_path
    app.state.connection = connection

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/v1/devices")
    def register_device(payload: DeviceRegistration, request: Request) -> dict[str, str]:
        upsert_device(request.app.state.connection, payload.device_code)
        return {"device_code": payload.device_code}

    @app.post("/api/v1/trips")
    def create_trip(payload: TripRequest, request: Request) -> dict:
        if (
            payload.origin.latitude == payload.destination.latitude
            and payload.origin.longitude == payload.destination.longitude
        ):
            raise HTTPException(status_code=422, detail="Origin and destination must be different")

        origin = _to_latlng(payload.origin)
        destination = _to_latlng(payload.destination)
        pathway = plan_road_pathway(origin, destination)
        heatmap = heatmap_along_pathway(pathway)
        save_trip(
            request.app.state.connection,
            payload.device_code,
            origin.latitude,
            origin.longitude,
            destination.latitude,
            destination.longitude,
            pathway.provider,
            pathway.distance_meters,
        )
        return {
            "origin": payload.origin.model_dump(),
            "destination": payload.destination.model_dump(),
            "pathway": {
                "coordinates": pathway.coordinates,
                "distance_meters": pathway.distance_meters,
                "duration_seconds": pathway.duration_seconds,
                "provider": pathway.provider,
            },
            "heatmap": heatmap,
        }

    @app.post("/api/v1/devices/{device_code}/location", status_code=204)
    def ping_location(device_code: str, payload: LocationPing, request: Request) -> Response:
        save_location(
            request.app.state.connection,
            device_code,
            payload.latitude,
            payload.longitude,
            payload.accuracy_meters,
        )
        return Response(status_code=204)

    @app.post("/api/v1/devices/{device_code}/location/heatmap")
    def location_heatmap(device_code: str, payload: LocationPing, request: Request) -> dict:
        db = request.app.state.connection
        save_location(db, device_code, payload.latitude, payload.longitude, payload.accuracy_meters)
        heatmap = heatmap_around_location(payload.latitude, payload.longitude)
        return {
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "heatmap": heatmap,
            "saved_pings": count_location_pings(db, device_code),
        }

    return app


def _to_latlng(point: GeoPoint) -> LatLng:
    return LatLng(latitude=point.latitude, longitude=point.longitude, label=point.label)
