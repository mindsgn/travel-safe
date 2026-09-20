import { EMERGENCY_SERVICES, buildTelUri, callEmergencyService } from './emergency-services';

describe('buildTelUri', () => {
  it('normalizes spaces and dashes from local numbers', () => {
    expect(buildTelUri('0861 400 800')).toBe('tel:0861400800');
    expect(buildTelUri('10111')).toBe('tel:10111');
    expect(buildTelUri('021 480 7700')).toBe('tel:0214807700');
  });

  it('returns null for unusable numbers', () => {
    expect(buildTelUri('')).toBeNull();
    expect(buildTelUri('12')).toBeNull();
  });
});

describe('callEmergencyService', () => {
  it('opens the dialer with the normalized number', async () => {
    const openUrl = jest.fn().mockResolvedValue(undefined);
    await expect(callEmergencyService('021 480 7700', openUrl)).resolves.toBe(true);
    expect(openUrl).toHaveBeenCalledWith('tel:0214807700');
  });

  it('returns false when the dialer cannot open', async () => {
    const openUrl = jest.fn().mockRejectedValue(new Error('no dialer'));
    await expect(callEmergencyService('10111', openUrl)).resolves.toBe(false);
  });

  it('returns false for an unusable number without calling out', async () => {
    const openUrl = jest.fn();
    await expect(callEmergencyService('12', openUrl)).resolves.toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });
});

describe('EMERGENCY_SERVICES', () => {
  it('exposes every listed service with name, number and hint', () => {
    expect(EMERGENCY_SERVICES.length).toBe(14);
    for (const service of EMERGENCY_SERVICES) {
      expect(service.name.length).toBeGreaterThan(0);
      expect(service.number.length).toBeGreaterThan(0);
      expect(service.hint.length).toBeGreaterThan(0);
    }
  });

  it('maps the core emergency numbers correctly', () => {
    const byId = new Map(EMERGENCY_SERVICES.map((service) => [service.id, service.number]));
    expect(byId.get('general')).toBe('112');
    expect(byId.get('police')).toBe('10111');
    expect(byId.get('medical')).toBe('10177');
    expect(byId.get('fire')).toBe('112');
    expect(byId.get('er24')).toBe('084 124');
    expect(byId.get('netcare')).toBe('082 911');
  });
});