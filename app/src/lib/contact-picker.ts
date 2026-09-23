import { Contact } from 'expo-contacts';

import { EMPTY_DRAFT, nameFromContact, pickBestPhone, type ContactDraft } from '@/lib/contacts';

export type PickedContact = Pick<
  Contact,
  'getFullName' | 'getGivenName' | 'getFamilyName' | 'getCompany' | 'getPhones' | 'getEmails'
>;

export type PickerApi = { presentPicker: () => Promise<PickedContact | null> };

const defaultPicker: PickerApi = { presentPicker: () => Contact.presentPicker() };

/**
 * Uses the system contact picker, which shares only the chosen person, so no address-book
 * permission is requested. Returns null if the user cancels.
 */
export async function pickContactDraft(api: PickerApi = defaultPicker): Promise<ContactDraft | null> {
  const picked = await api.presentPicker();
  if (!picked) return null;
  const [fullName, givenName, familyName, company, phones, emails] = await Promise.all([
    picked.getFullName().catch(() => null),
    picked.getGivenName().catch(() => null),
    picked.getFamilyName().catch(() => null),
    picked.getCompany().catch(() => null),
    picked.getPhones().catch(() => []),
    picked.getEmails().catch(() => []),
  ]);
  const email = emails.find((item) => item.address?.trim())?.address?.trim() ?? '';
  return {
    ...EMPTY_DRAFT,
    name: nameFromContact({ fullName, givenName, familyName, company }),
    phone: pickBestPhone(phones) ?? '',
    email,
  };
}
