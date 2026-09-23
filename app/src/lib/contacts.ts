/** Emergency-contact validation. Mirrors backend/code/deadman/contacts.py so errors show before a round trip. */

export const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;
const PHONE_SEPARATORS = /[\s\-().]/g;

export type ContactField = 'name' | 'email' | 'phone';
export type ContactErrorCode =
  | 'missing_name'
  | 'name_too_long'
  | 'invalid_email'
  | 'invalid_phone'
  | 'missing_channel'
  | 'whatsapp_requires_phone';

export type ContactDraft = { name: string; email: string; phone: string; whatsapp: boolean };
export type NormalizedContact = { name: string; email: string | null; phone: string | null; whatsapp: boolean };
export type EmergencyContact = NormalizedContact & { id: string; created_at: string; updated_at: string };
export type Channel = 'email' | 'whatsapp' | 'sms';

export type ContactValidation =
  | { ok: true; contact: NormalizedContact }
  | { ok: false; errors: Partial<Record<ContactField | 'form', ContactErrorCode>> };

export const EMPTY_DRAFT: ContactDraft = { name: '', email: '', phone: '', whatsapp: false };

export function normalizeEmail(raw: string): string | null | 'invalid' {
  const email = raw.trim().toLowerCase();
  if (!email) return null;
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) return 'invalid';
  return email;
}

/**
 * Normalizes to E.164. A local number with a leading 0 is converted using the
 * default calling code (from the SIM or locale) when one is known.
 */
export function normalizePhone(raw: string, defaultCallingCode?: string): string | null | 'invalid' {
  let phone = raw.trim().replace(PHONE_SEPARATORS, '');
  if (!phone) return null;
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  else if (!phone.startsWith('+') && defaultCallingCode && /^0\d+$/.test(phone)) {
    phone = `+${defaultCallingCode}${phone.slice(1)}`;
  }
  return E164_PATTERN.test(phone) ? phone : 'invalid';
}

export function validateContact(draft: ContactDraft, defaultCallingCode?: string): ContactValidation {
  const errors: Partial<Record<ContactField | 'form', ContactErrorCode>> = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'missing_name';
  else if (name.length > MAX_NAME_LENGTH) errors.name = 'name_too_long';

  const email = normalizeEmail(draft.email);
  if (email === 'invalid') errors.email = 'invalid_email';
  const phone = normalizePhone(draft.phone, defaultCallingCode);
  if (phone === 'invalid') errors.phone = 'invalid_phone';

  if (email === null && phone === null) errors.form = 'missing_channel';
  if (draft.whatsapp && phone === null) errors.phone = 'whatsapp_requires_phone';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    contact: {
      name,
      email: email === 'invalid' ? null : email,
      phone: phone === 'invalid' ? null : phone,
      whatsapp: draft.whatsapp,
    },
  };
}

export function draftFromContact(contact: NormalizedContact): ContactDraft {
  return {
    name: contact.name,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    whatsapp: contact.whatsapp,
  };
}

export function contactChannels(contact: Pick<NormalizedContact, 'email' | 'phone' | 'whatsapp'>): Channel[] {
  const channels: Channel[] = [];
  if (contact.email) channels.push('email');
  if (contact.phone) channels.push(contact.whatsapp ? 'whatsapp' : 'sms');
  return channels;
}

export type PhoneCandidate = { label?: string; number?: string; isPrimary?: boolean };

const PHONE_LABEL_PRIORITY = ['mobile', 'iphone', 'cell', 'main', 'home', 'work'];

function labelRank(label: string | undefined): number {
  const index = label ? PHONE_LABEL_PRIORITY.indexOf(label.toLowerCase()) : -1;
  return index === -1 ? PHONE_LABEL_PRIORITY.length : index;
}

/** Prefer primary, then mobile-like labels, keeping address-book order as the tiebreaker. */
export function pickBestPhone(phones: readonly PhoneCandidate[]): string | null {
  const ranked = phones
    .map((phone, index) => ({ phone, index }))
    .filter(({ phone }) => Boolean(phone.number?.trim()))
    .sort((a, b) => {
      if (Boolean(a.phone.isPrimary) !== Boolean(b.phone.isPrimary)) return a.phone.isPrimary ? -1 : 1;
      const rank = labelRank(a.phone.label) - labelRank(b.phone.label);
      return rank !== 0 ? rank : a.index - b.index;
    });
  return ranked[0]?.phone.number?.trim() ?? null;
}

export type ContactNameParts = {
  fullName?: string | null;
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  company?: string | null;
};

export function nameFromContact(parts: ContactNameParts): string {
  if (parts.fullName?.trim()) return parts.fullName.trim();
  const built = [parts.givenName, parts.middleName, parts.familyName].filter(Boolean).join(' ').trim();
  return built || parts.company?.trim() || '';
}
