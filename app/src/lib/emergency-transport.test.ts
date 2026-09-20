import { buildSmsUri, deliverLiveUpdate, deliverSosAlert } from './emergency-transport';

describe('buildSmsUri', () => {
  it('normalizes the phone and encodes the body', () => {
    const uri = buildSmsUri('+27 82 123 4567', 'Help needed! Live: -33.9,18.4');
    expect(uri).toBe(`sms:+27821234567?&body=${encodeURIComponent('Help needed! Live: -33.9,18.4')}`);
  });

  it('returns null for invalid phone numbers', () => {
    expect(buildSmsUri('123', 'body')).toBeNull();
    expect(buildSmsUri('', 'body')).toBeNull();
  });
});

describe('deliverSosAlert', () => {
  it('opens the sms app once per reachable recipient and counts successes', async () => {
    const openUrl = jest.fn().mockResolvedValue(undefined);
    const result = await deliverSosAlert({
      phones: ['+27821234567', 'invalid'],
      body: 'Emergency',
      openUrl,
    });

    expect(result).toEqual({ attempted: 1, succeeded: 1 });
    expect(openUrl).toHaveBeenCalledWith(
      `sms:+27821234567?&body=${encodeURIComponent('Emergency')}`,
    );
  });

  it('keeps going when a recipient fails to open', async () => {
    const openUrl = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('no sms app'));
    const result = await deliverSosAlert({
      phones: ['+27111111111', '+27222222222'],
      body: 'Emergency',
      openUrl,
    });

    expect(result).toEqual({ attempted: 2, succeeded: 1 });
  });

  it('returns zero attempts when there are no phones', async () => {
    const result = await deliverSosAlert({ phones: [], body: 'Emergency' });
    expect(result).toEqual({ attempted: 0, succeeded: 0 });
  });
});

describe('deliverLiveUpdate', () => {
  it('shares the update to each recipient with the same guarantees', async () => {
    const openUrl = jest.fn().mockResolvedValue(undefined);
    const result = await deliverLiveUpdate({
      phones: ['+27821234567'],
      body: 'Update: -33.9,18.42',
      openUrl,
    });

    expect(result).toEqual({ attempted: 1, succeeded: 1 });
    expect(openUrl).toHaveBeenCalledWith(
      `sms:+27821234567?&body=${encodeURIComponent('Update: -33.9,18.42')}`,
    );
  });
});