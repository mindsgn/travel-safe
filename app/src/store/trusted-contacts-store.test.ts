import * as Contacts from 'expo-contacts';

import * as repository from '@/db/trusted-contacts-repository';
import { useTrustedContactsStore } from '@/store/trusted-contacts-store';

jest.mock('expo-contacts', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

jest.mock('@/db/trusted-contacts-repository', () => ({
  listTrustedContacts: jest.fn(),
  getTrustedContact: jest.fn(),
  insertTrustedContact: jest.fn(),
  updateTrustedContact: jest.fn(),
  deleteTrustedContact: jest.fn(),
}));

const mockedContacts = Contacts as jest.Mocked<typeof Contacts>;
const mockedRepository = repository as jest.Mocked<typeof repository>;

const grantedResponse = {
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
  accessPrivileges: 'all',
};

function row(overrides: Partial<Parameters<typeof repository.insertTrustedContact>[0]> & { id?: string } = {}) {
  return {
    id: overrides.id ?? 'tc_1',
    name: 'Alex Molefe',
    phone: '+27821234567',
    relationship: 'family' as const,
    device_contact_id: null,
    created_at: 1,
    updated_at: 1,
  };
}

describe('useTrustedContactsStore', () => {
  beforeEach(() => {
    useTrustedContactsStore.setState({
      contacts: [],
      isLoaded: false,
      isLoading: false,
      error: null,
      permission: null,
    });
    jest.clearAllMocks();
  });

  describe('loadContacts', () => {
    it('loads contacts and marks the store loaded', async () => {
      mockedRepository.listTrustedContacts.mockResolvedValue([row()]);
      await useTrustedContactsStore.getState().loadContacts();

      const state = useTrustedContactsStore.getState();
      expect(state.contacts).toHaveLength(1);
      expect(state.isLoaded).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('surfaces an error when the database read fails', async () => {
      mockedRepository.listTrustedContacts.mockRejectedValue(new Error('db down'));
      await useTrustedContactsStore.getState().loadContacts();

      const state = useTrustedContactsStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.contacts).toHaveLength(0);
    });
  });

  describe('permissions', () => {
    it('stores the permission state', async () => {
      mockedContacts.getPermissionsAsync.mockResolvedValue(grantedResponse as never);
      const permission = await useTrustedContactsStore.getState().checkPermission();

      expect(permission.status).toBe('granted');
      expect(useTrustedContactsStore.getState().permission?.accessPrivileges).toBe('all');
    });

    it('returns true when permission is granted', async () => {
      mockedContacts.requestPermissionsAsync.mockResolvedValue(grantedResponse as never);
      await expect(useTrustedContactsStore.getState().requestPermission()).resolves.toBe(true);
    });

    it('returns false when permission is denied', async () => {
      mockedContacts.requestPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: false,
        expires: 'never',
        accessPrivileges: 'none',
      } as never);
      await expect(useTrustedContactsStore.getState().requestPermission()).resolves.toBe(false);
    });
  });

  describe('addContact', () => {
    it('inserts via the repository and prepends to the list', async () => {
      mockedRepository.insertTrustedContact.mockResolvedValue(row({ id: 'tc_new' }));
      const result = await useTrustedContactsStore.getState().addContact({
        name: 'Alex Molefe',
        phone: '+27821234567',
        relationship: 'friend',
      });

      expect(result).toMatchObject({ ok: true });
      expect(useTrustedContactsStore.getState().contacts[0].id).toBe('tc_new');
      expect(mockedRepository.insertTrustedContact).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicates regardless of formatting', async () => {
      useTrustedContactsStore.setState({
        contacts: [row({ phone: '+27821234567' })],
      });
      const result = await useTrustedContactsStore.getState().addContact({
        name: 'Someone Else',
        phone: '+27 82 123 4567',
        relationship: 'friend',
      });

      expect(result).toEqual({ ok: false, reason: 'duplicate' });
      expect(mockedRepository.insertTrustedContact).not.toHaveBeenCalled();
    });

    it('rejects when the limit is reached', async () => {
      useTrustedContactsStore.setState({
        contacts: Array.from({ length: 5 }, (_, index) => row({ id: `tc_${index}`, phone: `+2700000000${index}` })),
      });
      const result = await useTrustedContactsStore.getState().addContact({
        name: 'New Person',
        phone: '+27123456789',
        relationship: 'other',
      });

      expect(result).toEqual({ ok: false, reason: 'limit' });
    });
  });

  describe('updateContact', () => {
    it('updates the row through the repository and replaces it in state', async () => {
      useTrustedContactsStore.setState({ contacts: [row()] });
      const result = await useTrustedContactsStore.getState().updateContact('tc_1', {
        name: 'Alex M.',
        phone: '+27820000000',
        relationship: 'partner',
      });

      expect(result).toMatchObject({ ok: true });
      expect(mockedRepository.updateTrustedContact).toHaveBeenCalledWith('tc_1', {
        name: 'Alex M.',
        phone: '+27820000000',
        relationship: 'partner',
      });
      expect(useTrustedContactsStore.getState().contacts[0]).toMatchObject({
        id: 'tc_1',
        name: 'Alex M.',
        phone: '+27820000000',
        relationship: 'partner',
      });
    });

    it('allows keeping the same phone on an edit (no self-duplicate)', async () => {
      useTrustedContactsStore.setState({ contacts: [row({ phone: '+27821234567' })] });
      const result = await useTrustedContactsStore.getState().updateContact('tc_1', {
        name: 'Alex Molefe',
        phone: '+27821234567',
        relationship: 'family',
      });

      expect(result).toMatchObject({ ok: true });
    });
  });

  describe('removeContact', () => {
    it('deletes through the repository and drops it from state', async () => {
      useTrustedContactsStore.setState({ contacts: [row({ id: 'tc_a' }), row({ id: 'tc_b' })] });
      await useTrustedContactsStore.getState().removeContact('tc_a');

      expect(mockedRepository.deleteTrustedContact).toHaveBeenCalledWith('tc_a');
      expect(useTrustedContactsStore.getState().contacts.map((c) => c.id)).toEqual(['tc_b']);
    });
  });
});