import {
  buildAlertStatusText,
  buildSosAlertBody,
  buildSosUpdateBody,
  countdownRemainingMs,
  createEmergencyId,
  formatAccuracy,
  formatStartedAt,
  interpolate,
  mapsLinkForPosition,
  shouldUpdateLocation,
  type EmergencyPosition,
} from './emergency';

describe('countdownRemainingMs', () => {
  it('returns full duration before the deadline', () => {
    expect(countdownRemainingMs(1_000, 100)).toBe(900);
  });

  it('returns 0 exactly at and after the deadline', () => {
    expect(countdownRemainingMs(1_000, 1_000)).toBe(0);
    expect(countdownRemainingMs(1_000, 1_500)).toBe(0);
  });

  it('clamps negative remaining time to 0', () => {
    expect(countdownRemainingMs(0, 5)).toBe(0);
  });
});

describe('createEmergencyId', () => {
  it('produces unique-looking prefixed ids', () => {
    const a = createEmergencyId();
    const b = createEmergencyId();
    expect(a).toMatch(/^emg_[0-9a-z]+_[0-9a-z]+$/);
    expect(a).not.toBe(b);
  });
});

describe('formatAccuracy', () => {
  it('formats whole meters with a ± prefix', () => {
    expect(formatAccuracy(10)).toBe('±10 m');
    expect(formatAccuracy(10.4)).toBe('±10 m');
  });

  it('bucketizes sub-meter accuracy', () => {
    expect(formatAccuracy(0.6)).toBe('±<1 m');
  });

  it('returns null for missing, negative or non-finite values', () => {
    expect(formatAccuracy(null)).toBeNull();
    expect(formatAccuracy(undefined)).toBeNull();
    expect(formatAccuracy(-3)).toBeNull();
    expect(formatAccuracy(Number.NaN)).toBeNull();
  });
});

describe('mapsLinkForPosition', () => {
  it('returns comma-separated lat,lng', () => {
    expect(mapsLinkForPosition({ latitude: -33.9249, longitude: 18.4241 })).toBe(
      '-33.9249,18.4241',
    );
  });
});

describe('formatStartedAt', () => {
  it('converts a timestamp to a stable ISO string', () => {
    expect(formatStartedAt(1_700_000_000_000)).toBe(new Date(1_700_000_000_000).toISOString());
  });
});

describe('interpolate', () => {
  it('replaces known placeholders and leaves unknown ones', () => {
    expect(interpolate('Hi {name}, {missing}', { name: 'Alex' })).toBe('Hi Alex, {missing}');
  });
});

describe('buildSosAlertBody', () => {
  const startedAt = 1_700_000_000_000;

  it('includes the maps link and accuracy when a position is known', () => {
    const body = buildSosAlertBody({
      appName: 'Travel Safe',
      startedAt,
      position: { latitude: -33.9, longitude: 18.4, accuracyMeters: 12, timestamp: startedAt },
    });
    expect(body).toContain('-33.9,18.4');
    expect(body).toContain('(accuracy ±12 m)');
    expect(body).toContain('Travel Safe');
    expect(body).toContain(formatStartedAt(startedAt));
  });

  it('falls back cleanly when no position is available yet', () => {
    const body = buildSosAlertBody({ appName: 'Travel Safe', startedAt, position: null });
    expect(body).toContain('Unavailable');
    expect(body).toContain('accuracy unknown');
  });
});

describe('buildSosUpdateBody', () => {
  it('builds a live update sharing the current coordinates', () => {
    const position = { latitude: -33.9, longitude: 18.42, accuracyMeters: 8, timestamp: 1 };
    const body = buildSosUpdateBody({ appName: 'Travel Safe', position, startedAt: 1_700_000_000_000 });
    expect(body).toContain('-33.9,18.42');
    expect(body).toContain('(accuracy ±8 m)');
    expect(body).toContain('live location update');
  });
});

describe('shouldUpdateLocation', () => {
  const base: EmergencyPosition = { latitude: -33.9, longitude: 18.4, accuracyMeters: 10, timestamp: 100 };
  const nearby: EmergencyPosition = { ...base, latitude: -33.90001 };

  it('sends immediately when nothing was sent yet', () => {
    expect(
      shouldUpdateLocation({
        now: 200,
        lastSentAt: null,
        lastSharedPosition: null,
        currentPosition: base,
        intervalMs: 15_000,
        minMovementMeters: 25,
      }),
    ).toBe(true);
  });

  it('waits for the interval to elapse', () => {
    expect(
      shouldUpdateLocation({
        now: 100,
        lastSentAt: 100,
        lastSharedPosition: base,
        currentPosition: base,
        intervalMs: 15_000,
        minMovementMeters: 25,
      }),
    ).toBe(false);
  });

  it('sends after the interval when the user moved far enough', () => {
    const far = { ...base, latitude: -33.899 }; // > 25m away
    expect(
      shouldUpdateLocation({
        now: 16_000,
        lastSentAt: 0,
        lastSharedPosition: base,
        currentPosition: far,
        intervalMs: 15_000,
        minMovementMeters: 25,
      }),
    ).toBe(true);
  });

  it('skips updates when the user barely moved', () => {
    expect(
      shouldUpdateLocation({
        now: 20_000,
        lastSentAt: 0,
        lastSharedPosition: base,
        currentPosition: nearby,
        intervalMs: 15_000,
        minMovementMeters: 25,
      }),
    ).toBe(false);
  });
});

describe('buildAlertStatusText', () => {
  it('announces a single delivered recipient', () => {
    expect(buildAlertStatusText({ recipientCount: 1, alertSent: true, hasRecipients: true })).toContain(
      '1 trusted contact',
    );
  });

  it('announces multiple delivered recipients', () => {
    expect(buildAlertStatusText({ recipientCount: 3, alertSent: true, hasRecipients: true })).toContain(
      '3 trusted contacts',
    );
  });

  it('explains there are no recipients to alert', () => {
    expect(buildAlertStatusText({ recipientCount: 0, alertSent: false, hasRecipients: false })).toContain(
      'no trusted contacts',
    );
  });

  it('surfaces a delivery failure when recipients were expected', () => {
    expect(buildAlertStatusText({ recipientCount: 0, alertSent: false, hasRecipients: true })).toContain(
      'could not be delivered',
    );
  });
});