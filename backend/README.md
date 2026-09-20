# Travel Safe API

Python FastAPI service with SQLite storage.

## Run

```bash
cd backend/code
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Tests

```bash
pip install ruff pytest
ruff check .
pytest -v
```

## Endpoints

- `POST /api/v1/trips` — origin and destination in, roadway polyline and heatmap along the path out
- `POST /api/v1/devices/{device_code}/location` — save GPS, empty 204 response
- `POST /api/v1/devices/{device_code}/location/heatmap` — save GPS and return a local heatmap
- `POST /api/v1/devices` — register the phone’s unique code
