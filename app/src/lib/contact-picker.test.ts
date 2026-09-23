import { pickContactDraft, type PickedContact } from './contact-picker';

jest.mock('expo-contacts', () => ({ Contact: { presentPicker: jest.fn() } }));

function picked(overrides: Partial<Record<keyof PickedContact, jest.Mock>> = {}): PickedContact {
  return {
    getFullName: jest.fn(async () => 'Sipho Dlamini'),
    getGivenName: jest.fn(async () => 'Sipho'),
    getFamilyName: jest.fn(async () => 'Dlamini'),
    getCompany: jest.fn(async () => null),
    getPhones: jest.fn(async () => [
      { id: '1', label: 'work', number: '011 000 0000' },
      { id: '2', label: 'mobile', number: '+27 82 123 4567' },
    ]),
    getEmails: jest.fn(async () => [{ id: 'e', address: ' sipho@example.com ' }]),
    ...overrides,
  } as unknown as PickedContact;
}

describe('pickContactDraft', () => {
  it('fills a draft with the best phone and first email', async () => {
    await expect(pickContactDraft({ presentPicker: async () => picked() })).resolves.toEqual({
      name: 'Sipho Dlamini',
      phone: '+27 82 123 4567',
      email: 'sipho@example.com',
      whatsapp: false,
    });
  });

  it('returns null when the user cancels', async () => {
    await expect(pickContactDraft({ presentPicker: async () => null })).resolves.toBeNull();
  });

  it('tolerates missing fields', async () => {
    const contact = picked({
      getFullName: jest.fn().mockRejectedValue(new Error('x')),
      getPhones: jest.fn().mockRejectedValue(new Error('x')),
      getEmails: jest.fn(async () => []),
    });
    await expect(pickContactDraft({ presentPicker: async () => contact })).resolves.toEqual({
      name: 'Sipho Dlamini',
      phone: '',
      email: '',
      whatsapp: false,
    });
  });
});
