import { assessHealth, readDeviceState, type BatteryApi } from './device-state';

function battery(state: object | Error): BatteryApi {
  return {
    getPowerStateAsync: jest.fn(async () => {
      if (state instanceof Error) throw state;
      return state;
    }),
  } as unknown as BatteryApi;
}

describe('readDeviceState', () => {
  it('reads battery level and low power mode', async () => {
    await expect(readDeviceState(battery({ batteryLevel: 0.42, lowPowerMode: true }))).resolves.toEqual({
      batteryLevel: 0.42,
      lowPowerMode: true,
    });
  });

  it('treats unknown values (-1, e.g. simulators) as null', async () => {
    await expect(readDeviceState(battery({ batteryLevel: -1 }))).resolves.toEqual({
      batteryLevel: null,
      lowPowerMode: null,
    });
  });

  it('never throws', async () => {
    await expect(readDeviceState(battery(new Error('unavailable')))).resolves.toEqual({
      batteryLevel: null,
      lowPowerMode: null,
    });
  });
});

describe('assessHealth', () => {
  const healthy = {
    contactCount: 2,
    notifications: 'granted' as const,
    location: 'granted' as const,
    backgroundAvailable: true,
    device: { batteryLevel: 0.9, lowPowerMode: false },
  };

  it('reports nothing when everything is fine', () => {
    expect(assessHealth(healthy)).toEqual([]);
  });

  it('warns about every problem in priority order', () => {
    expect(
      assessHealth({
        contactCount: 0,
        notifications: 'denied',
        location: 'denied',
        backgroundAvailable: false,
        device: { batteryLevel: 0.05, lowPowerMode: true },
      }),
    ).toEqual(['no_contacts', 'notifications_off', 'location_off', 'background_restricted', 'low_power_mode', 'battery_low']);
  });

  it('does not warn about permissions that were never asked', () => {
    expect(assessHealth({ ...healthy, notifications: 'undetermined', location: 'undetermined' })).toEqual([]);
  });

  it('ignores unknown battery levels', () => {
    expect(assessHealth({ ...healthy, device: { batteryLevel: null, lowPowerMode: null } })).toEqual([]);
  });
});
