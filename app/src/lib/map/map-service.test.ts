import {
  boundsFromCoordinates,
  createMapboxNativeHandle,
  createMapController,
  expandBounds,
  paddingFromEdge,
  type NativeMapHandle,
} from './map-service';
import { latitudeDeltaForZoom, longitudeDeltaForZoom, zoomForLatitudeDelta, DEFAULT_LATITUDE_DELTA } from './regions';

function makeNativeHandle(): {
  handle: NativeMapHandle;
  animateToRegion: jest.Mock;
  getCamera: jest.Mock;
  fitToCoordinates: jest.Mock;
  animateCamera: jest.Mock;
} {
  const animateToRegion = jest.fn();
  const getCamera = jest.fn();
  const fitToCoordinates = jest.fn();
  const animateCamera = jest.fn();
  const handle: NativeMapHandle = {
    animateToRegion,
    getCamera,
    fitToCoordinates,
    animateCamera,
  };
  return { handle, animateToRegion, getCamera, fitToCoordinates, animateCamera };
}

const REGION = { latitude: -33.9, longitude: 18.4, latitudeDelta: 0.1, longitudeDelta: 0.12 };

describe('createMapController', () => {
  it('is attached to a native handle by default', () => {
    const controller = createMapController(null);
    expect(controller.animateToRegion(REGION)).toBe('unavailable');
    expect(controller.fitToCoordinates([{ latitude: -33.9, longitude: 18.4 }])).toBe('unavailable');
  });

  describe('animateToRegion', () => {
    it('delegates to the native handle and reports ok', () => {
      const { handle, animateToRegion } = makeNativeHandle();
      const controller = createMapController(handle);
      const result = controller.animateToRegion(REGION, 500);
      expect(result).toBe('ok');
      expect(animateToRegion).toHaveBeenCalledWith(REGION, 500);
    });

    it('reports unavailable when the native method is missing', () => {
      const controller = createMapController({});
      expect(controller.animateToRegion(REGION)).toBe('unavailable');
    });
  });

  describe('recenter', () => {
    it('moves the region to the target coordinate', () => {
      const { handle, animateToRegion } = makeNativeHandle();
      const controller = createMapController(handle);
      const target = { latitude: -33.95, longitude: 18.42 };
      const result = controller.recenter(target, REGION);
      expect(result).toBe('ok');
      expect(animateToRegion).toHaveBeenCalledWith(
        { ...REGION, latitude: -33.95, longitude: 18.42 },
        300,
      );
    });
  });

  describe('zoomBy', () => {
    it('zooms from the current camera zoom when available', async () => {
      const { handle, animateToRegion, getCamera } = makeNativeHandle();
      getCamera.mockResolvedValue({ center: { latitude: -33.9, longitude: 18.4 }, zoom: 12 });
      const controller = createMapController(handle);
      const result = await controller.zoomBy({ latitude: -33.9, longitude: 18.4 }, 2);
      expect(result).toBe('ok');
      const arg = animateToRegion.mock.calls[0][0] as { latitudeDelta: number; longitudeDelta: number };
      expect(arg.latitudeDelta).toBeCloseTo(latitudeDeltaForZoom(14));
      expect(arg.longitudeDelta).toBeCloseTo(longitudeDeltaForZoom(14, -33.9));
    });

    it('falls back to the default zoom when camera is unknown', async () => {
      const { handle, animateToRegion, getCamera } = makeNativeHandle();
      getCamera.mockRejectedValue(new Error('nope'));
      const controller = createMapController(handle);
      const result = await controller.zoomBy({ latitude: -33.9, longitude: 18.4 }, -1);
      expect(result).toBe('ok');
      const arg = animateToRegion.mock.calls[0][0] as { latitudeDelta: number };
      expect(arg.latitudeDelta).toBeCloseTo(
        latitudeDeltaForZoom(zoomForLatitudeDelta(DEFAULT_LATITUDE_DELTA) - 1),
      );
    });

    it('reports unavailable when no native handle exists', async () => {
      const controller = createMapController(null);
      await expect(controller.zoomBy({ latitude: -33.9, longitude: 18.4 }, 1)).resolves.toBe(
        'unavailable',
      );
    });
  });

  describe('fitToCoordinates', () => {
    it('fits the native map to the given coordinates', () => {
      const { handle, fitToCoordinates } = makeNativeHandle();
      const controller = createMapController(handle);
      const points = [
        { latitude: -33.9, longitude: 18.4 },
        { latitude: -33.95, longitude: 18.45 },
      ];
      const result = controller.fitToCoordinates(points, { edgePadding: { top: 10, right: 10, bottom: 10, left: 10 } });
      expect(result).toBe('ok');
      expect(fitToCoordinates).toHaveBeenCalledWith(
        points,
        { edgePadding: { top: 10, right: 10, bottom: 10, left: 10 }, animated: true },
      );
    });

    it('skips invalid coordinates', () => {
      const { handle, fitToCoordinates } = makeNativeHandle();
      const controller = createMapController(handle);
      const points = [
        { latitude: 300, longitude: 18.4 },
        { latitude: -33.9, longitude: 18.4 },
      ];
      controller.fitToCoordinates(points);
      expect(fitToCoordinates).toHaveBeenCalledWith(
        [{ latitude: -33.9, longitude: 18.4 }],
        { animated: true },
      );
    });

    it('reports unavailable for an empty point list', () => {
      const { handle } = makeNativeHandle();
      const controller = createMapController(handle);
      expect(controller.fitToCoordinates([])).toBe('unavailable');
    });

    it('reports unavailable when the native method is missing', () => {
      const controller = createMapController({});
      expect(controller.fitToCoordinates([{ latitude: -33.9, longitude: 18.4 }])).toBe('unavailable');
    });
  });
});

describe('createMapboxNativeHandle', () => {
  it('maps region animation onto the Mapbox camera', async () => {
    const setCamera = jest.fn();
    const fitBounds = jest.fn();
    const handle = createMapboxNativeHandle({ setCamera, fitBounds });
    handle.animateToRegion?.(REGION, 250);
    expect(setCamera).toHaveBeenCalledWith(
      expect.objectContaining({
        centerCoordinate: [18.4, -33.9],
        animationDuration: 250,
      }),
    );
    const camera = await handle.getCamera?.();
    expect(camera?.center).toEqual({ latitude: -33.9, longitude: 18.4 });
  });

  it('fits bounds from coordinates', () => {
    const fitBounds = jest.fn();
    const handle = createMapboxNativeHandle({ fitBounds });
    handle.fitToCoordinates?.(
      [
        { latitude: -33.9, longitude: 18.4 },
        { latitude: -33.95, longitude: 18.45 },
      ],
      { edgePadding: { top: 10, right: 20, bottom: 30, left: 40 } },
    );
    expect(fitBounds).toHaveBeenCalledWith([18.45, -33.9], [18.4, -33.95], [10, 20, 30, 40], 400);
  });

  it('computes padding and bounds helpers', () => {
    expect(paddingFromEdge()).toBe(48);
    expect(paddingFromEdge({ top: 1, right: 2, bottom: 3, left: 4 })).toEqual([1, 2, 3, 4]);
    expect(boundsFromCoordinates([])).toBeNull();
    expect(boundsFromCoordinates([{ latitude: -33.9, longitude: 18.4 }])).toEqual({
      ne: [18.4, -33.9],
      sw: [18.4, -33.9],
    });
    const expanded = expandBounds({ ne: [18.45, -33.9], sw: [18.4, -33.95] });
    expect(expanded.ne[0]).toBeGreaterThan(18.45);
    expect(expanded.sw[0]).toBeLessThan(18.4);
    expect(expanded.ne[1]).toBeGreaterThan(-33.9);
    expect(expanded.sw[1]).toBeLessThan(-33.95);
  });
});