# Travel Safe · Frontend

Expo React Native app for **Travel Safe**, a mobile safety companion. The home screen is a Mapbox map with a neighbourhood crime heatmap, live GPS, and trip planning (origin, destination, pathway).

Built with Expo SDK 57, React Native 0.86 (New Architecture), React 19, and TypeScript.

## Features

- **Trip planning** — search origin and destination (Mapbox Geocoding, with Cape Town mock suggestions when no token is set), or use current location as origin. The app calls `POST /api/v1/trips` and draws the pathway plus a crime heatmap along the corridor.
- **Crime heatmap** — Mapbox `HeatmapLayer` from backend cells (or local mock zones until a trip is planned). Red is more dangerous, green is safer.
- **Live location** — foreground GPS via `expo-location` (`hooks/use-map-location.ts`) with a recoverable status card.
- **Native maps** — `@rnmapbox/maps` behind `components/map/safety-map.tsx`. Native-only; web falls back to placeholder copy.

## Project structure

```
src/
  app/            Expo Router routes and layouts (Home screen in (home)/index.tsx)
  components/     UI: map/, trip/, safety-legend, themed-text/view
  constants/      theme tokens
  hooks/          use-map-location, use-trip-plan, use-emergency-location
  i18n/           strings.ts — single source of all user-visible copy
  lib/            API client, geocoding, heatmap GeoJSON, map camera helpers
e2e/              Maestro YAML scenarios (including e2e/trip-plan.yaml)
```

Keep screens thin and put reusable logic in `lib/`, shared UI in `components/`, all copy in `i18n/strings.ts`, and a stable `testID` on every interactive control. See [AGENTS.md](./AGENTS.md) for the full convention guide.

## Getting started

```bash
cp .env.example .env.local
# set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN and RNMAPBOX_MAPS_DOWNLOAD_TOKEN
npm install
npx expo run:ios
# or: npx expo run:android
```

Mapbox requires a **development build** (`expo run:ios` / `expo run:android`), not Expo Go. Rebuild native projects after adding the Mapbox plugin.

The API defaults to `http://127.0.0.1:8000`. Start the backend with `../backend/scripts/app.sh run`.

### Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start the Expo dev server (Metro) |
| `npm run ios` | Build & run the iOS dev build (`expo run:ios`) |
| `npm run android` | Build & run the Android dev build (`expo run:android`) |
| `npm run web` | Run the web target (`expo start --web`) — the map screen is native-only |
| `npm test` | Unit tests (Jest / jest-expo) |
| `npm run lint` | ESLint (`expo lint`) |

## Native builds

`ios/` and `android/` are generated and gitignored. Regenerate them with `npx expo prebuild`.

- **iOS scene support** — `expo-build-properties` sets `ios.enableSceneSupport: true`.
- **Location permissions** — `expo-location` (`locationWhenInUsePermission`). Bundle id: `makers.travel.safe`; scheme: `travelsafe`.
- **Mapbox** — `@rnmapbox/maps` plugin reads `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` (secret downloads token). Runtime tiles and geocoding use `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`. Never commit tokens.

Expo config lives in `app.config.ts`.

## Testing

- **Unit** — `npm test`. Logic lives next to the code as `*.test.ts` / `*.test.tsx`.
- **E2E** — [Maestro](https://maestro.mobile.dev) flows in `e2e/`. `e2e/trip-plan.yaml` searches origin and destination and expects a pathway; run the backend locally so `POST /api/v1/trips` succeeds.

  ```bash
  maestro test e2e/safety-map.yaml
  maestro test e2e/trip-plan.yaml
  maestro test e2e/map/
  ```

## Limitations

- Corridor crime cells from the API are **mock intensity**, not live SAPS incident pins.
- Place search falls back to a small Cape Town fixture list when Mapbox Geocoding is unavailable.
- `@rnmapbox/maps` is **iOS/Android only**; the web target builds but the map screen does not render on web.
