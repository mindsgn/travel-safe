import * as Contacts from 'expo-contacts';
import { create } from 'zustand';

import * as repository from '@/db/trusted-contacts-repository';
import type { TrustedContactRow } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { resolveContactDraft, type TrustedContactInput } from '@/lib/trusted-contacts';

export type ContactPermissionState = {
  status: Contacts.ContactsPermissionResponse['status'];
  canAskAgain: boolean;
  accessPrivileges?: 'all' | 'limited' | 'none';
};

export type AddContactFailureReason = 'missing_name' | 'invalid_phone' | 'duplicate' | 'limit';

export type AddContactResult =
  | { ok: true; contact: TrustedContactRow }
  | { ok: false; reason: AddContactFailureReason };

type TrustedContactsState = {
  contacts: TrustedContactRow[];
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  permission: ContactPermissionState | null;
  loadContacts: () => Promise<void>;
  checkPermission: () => Promise<ContactPermissionState>;
  requestPermission: () => Promise<boolean>;
  addContact: (input: TrustedContactInput) => Promise<AddContactResult>;
  updateContact: (id: string, input: TrustedContactInput) => Promise<AddContactResult>;
  removeContact: (id: string) => Promise<void>;
};

function mapPermission(response: Contacts.ContactsPermissionResponse): ContactPermissionState {
  return {
    status: response.status,
    canAskAgain: response.canAskAgain,
    accessPrivileges: response.accessPrivileges,
  };
}

export const useTrustedContactsStore = create<TrustedContactsState>((set, get) => ({
  contacts: [],
  isLoaded: false,
  isLoading: false,
  error: null,
  permission: null,

  loadContacts: async () => {
    set({ isLoading: true, error: null });
    try {
      const contacts = await repository.listTrustedContacts();
      set({ contacts, isLoaded: true, isLoading: false });
    } catch {
      set({ error: strings.trustedContacts.add.errors.loadFailed, isLoaded: true, isLoading: false });
    }
  },

  checkPermission: async () => {
    const permission = mapPermission(await Contacts.getPermissionsAsync());
    set({ permission });
    return permission;
  },

  requestPermission: async () => {
    const permission = mapPermission(await Contacts.requestPermissionsAsync());
    set({ permission });
    return permission.status === 'granted';
  },

  addContact: async (input) => {
    const outcome = resolveContactDraft(input, {
      existingPhoneNumbers: get().contacts.map((contact) => contact.phone),
      count: get().contacts.length,
    });
    if (!outcome.ok) return { ok: false, reason: outcome.reason };

    const contact = await repository.insertTrustedContact(outcome.draft);
    set((state) => ({ contacts: [contact, ...state.contacts] }));
    return { ok: true, contact };
  },

  updateContact: async (id, input) => {
    const existing = get().contacts;
    const edited = existing.find((contact) => contact.id === id);
    const outcome = resolveContactDraft(input, {
      existingPhoneNumbers: existing
        .filter((contact) => contact.id !== id)
        .map((contact) => contact.phone),
      count: existing.length,
    });
    if (!outcome.ok) return { ok: false, reason: outcome.reason };

    await repository.updateTrustedContact(id, {
      name: outcome.draft.name,
      phone: outcome.draft.phone,
      relationship: outcome.draft.relationship,
    });
    const updated: TrustedContactRow = {
      id,
      name: outcome.draft.name,
      phone: outcome.draft.phone,
      relationship: outcome.draft.relationship,
      device_contact_id: edited?.device_contact_id ?? outcome.draft.deviceContactId,
      created_at: edited?.created_at ?? Date.now(),
      updated_at: Date.now(),
    };
    set((state) => ({
      contacts: state.contacts.map((contact) => (contact.id === id ? updated : contact)),
    }));
    return { ok: true, contact: updated };
  },

  removeContact: async (id) => {
    await repository.deleteTrustedContact(id);
    set((state) => ({ contacts: state.contacts.filter((contact) => contact.id !== id) }));
  },
}));