import { buildInviteMessage, inviteContactBySms, type SmsApi } from './sms';

function api(available: boolean, result: string | Error = 'sent') {
  return {
    isAvailableAsync: jest.fn(async () => available),
    sendSMSAsync: jest.fn(async () => {
      if (result instanceof Error) throw result;
      return { result };
    }),
  } as unknown as SmsApi & { sendSMSAsync: jest.Mock };
}

describe('sms invite', () => {
  it('includes the user name and sets expectations', () => {
    const message = buildInviteMessage('Thandi');
    expect(message).toContain('Thandi');
    expect(message).toContain('No need to do anything now');
  });

  it('opens the composer with the contact number', async () => {
    const fake = api(true);
    await expect(inviteContactBySms('+27821234567', 'Thandi', fake)).resolves.toBe('sent');
    expect(fake.sendSMSAsync).toHaveBeenCalledWith(['+27821234567'], buildInviteMessage('Thandi'));
  });

  it('handles devices without SMS and composer failures', async () => {
    await expect(inviteContactBySms('+1', 'T', api(false))).resolves.toBe('unavailable');
    await expect(inviteContactBySms('+1', 'T', api(true, 'cancelled'))).resolves.toBe('cancelled');
    await expect(inviteContactBySms('+1', 'T', api(true, 'weird'))).resolves.toBe('unknown');
    await expect(inviteContactBySms('+1', 'T', api(true, new Error('x')))).resolves.toBe('unknown');
  });
});
