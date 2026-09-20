import type { MapCoordinate, MapRegion } from './map.types';
import { isValidCoordinate } from './coordinates';
import { regionForCamera, zoomForLatitudeDelta, DEFAULT_LATITUDE_DELTA } from './regions';

export type NativeMapHandle = {
  animateToRegion?: (region: MapRegion, durationMs?: number) => void;
  animateCamera?: (camera: { center: MapCoordinate; zoom: number }, options?: { duration?: number }) => void;
  getCamera?: () => Promise<{ center: MapCoordinate; zoom?: number } | undefined | null>;
  fitToCoordinates?: (
    coordinates: MapCoordinate[],
    options?: { edgePadding?: { top: number; right: number; bottom: number; left: number }; animated?: boolean },
  ) => void;
};

export type MapboxCameraHandle = {
  setCamera?: (config: {
    centerCoordinate?: [number, number];
    zoomLevel?: number;
    animationDuration?: number;
  }) => void;
  fitBounds?: (
    ne: [number, number],
    sw: [number, number],
    padding?: number | number[],
    duration?: number,
  ) => void;
};

export type MapCommandResult = 'ok' | 'unavailable';

export type FitToOptions = {
  edgePadding?: { top: number; right: number; bottom: number; left: number };
  animated?: boolean;
};

export type MapController = {
  animateToRegion(region: MapRegion, durationMs?: number): MapCommandResult;
  recenter(coordinate: MapCoordinate, region: MapRegion, durationMs?: number): MapCommandResult;
  zoomBy(anchor: MapCoordinate, deltaZoom: number, durationMs?: number): Promise<MapCommandResult>;
  fitToCoordinates(coordinates: readonly MapCoordinate[], options?: FitToOptions): MapCommandResult;
};

export type MapControllerFactory = (handle: NativeMapHandle | null | undefined) => MapController;

export const createMapController: MapControllerFactory = (handle) => ({
  animateToRegion(region, durationMs = 300) {
    if (!handle?.animateToRegion) return 'unavailable';
    handle.animateToRegion({ ...region }, durationMs);
    return 'ok';
  },

  recenter(coordinate, region, durationMs = 300) {
    return this.animateToRegion({ ...region, latitude: coordinate.latitude, longitude: coordinate.longitude }, durationMs);
  },

  async zoomBy(anchor, deltaZoom, durationMs = 300) {
    let currentZoom: number | null = null;
    if (handle?.getCamera) {
      try {
        const camera = await handle.getCamera();
        currentZoom = camera?.zoom ?? null;
      } catch {
        currentZoom = null;
      }
    }
    const baseZoom = currentZoom ?? zoomForLatitudeDelta(DEFAULT_LATITUDE_DELTA);
    return this.animateToRegion(regionForCamera({ center: anchor, zoom: baseZoom + deltaZoom }), durationMs);
  },

  fitToCoordinates(coordinates, options) {
    if (!handle?.fitToCoordinates) return 'unavailable';
    const points = coordinates.filter((coordinate) => isValidCoordinate(coordinate));
    if (points.length === 0) return 'unavailable';
    handle.fitToCoordinates(points, { ...options, animated: true });
    return 'ok';
  },
});

export function paddingFromEdge(
  edgePadding?: { top: number; right: number; bottom: number; left: number },
): number | number[] {
  if (!edgePadding) return 48;
  return [edgePadding.top, edgePadding.right, edgePadding.bottom, edgePadding.left];
}

export function expandBounds(
  bounds: { ne: [number, number]; sw: [number, number] },
  fraction = 0.22,
  minSpan = 0.012,
): { ne: [number, number]; sw: [number, number] } {
  const lngSpan = Math.max(minSpan, bounds.ne[0] - bounds.sw[0]);
  const latSpan = Math.max(minSpan, bounds.ne[1] - bounds.sw[1]);
  const padLng = lngSpan * fraction;
  const padLat = latSpan * fraction;
  return {
    ne: [bounds.ne[0] + padLng, bounds.ne[1] + padLat],
    sw: [bounds.sw[0] - padLng, bounds.sw[1] - padLat],
  };
}
export function boundsFromCoordinates(coordinates: readonly MapCoordinate[]): {
  ne: [number, number];
  sw: [number, number];
} | null {
  const points = coordinates.filter((coordinate) => isValidCoordinate(coordinate));
  if (points.length === 0) return null;
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  return {
    ne: [Math.max(...lngs), Math.max(...lats)],
    sw: [Math.min(...lngs), Math.min(...lats)],
  };
}

export function createMapboxNativeHandle(camera: MapboxCameraHandle | null | undefined): NativeMapHandle {
  let lastCenter: MapCoordinate = { latitude: -33.9249, longitude: 18.4241 };
  let lastZoom = 12;

  return {
    animateToRegion(region, durationMs = 300) {
      lastCenter = { latitude: region.latitude, longitude: region.longitude };
      lastZoom = zoomForLatitudeDelta(region.latitudeDelta);
      camera?.setCamera?.({
        centerCoordinate: [region.longitude, region.latitude],
        zoomLevel: lastZoom,
        animationDuration: durationMs,
      });
    },
    animateCamera(nextCamera, options) {
      lastCenter = nextCamera.center;
      lastZoom = nextCamera.zoom;
      camera?.setCamera?.({
        centerCoordinate: [nextCamera.center.longitude, nextCamera.center.latitude],
        zoomLevel: nextCamera.zoom,
        animationDuration: options?.duration ?? 300,
      });
    },
    getCamera: async () => ({ center: lastCenter, zoom: lastZoom }),
    fitToCoordinates(coordinates, options) {
      const bounds = boundsFromCoordinates(coordinates);
      if (!bounds) return;
      camera?.fitBounds?.(
        bounds.ne,
        bounds.sw,
        paddingFromEdge(options?.edgePadding),
        options?.animated === false ? 0 : 400,
      );
    },
  };
}