export const TRUSTED_CONTACT_LIMIT = 5;

export const RELATIONSHIPS = ['family', 'partner', 'friend', 'caregiver', 'other'] as const;
export type RelationshipKey = (typeof RELATIONSHIPS)[number];

export const DEFAULT_RELATIONSHIP: RelationshipKey = 'family';

export type TrustedContactInput = {
  name: string;
  phone: string;
  relationship: RelationshipKey;
  deviceContactId?: string | null;
};

export type TrustedContactDraft = {
  name: string;
  phone: string;
  relationship: RelationshipKey;
  deviceContactId: string | null;
};

export type PhoneCandidate = {
  label?: string;
  number: string;
  isPrimary?: boolean;
};

export type AddContactFailureReason = 'missing_name' | 'invalid_phone' | 'duplicate' | 'limit';

export type AddContactOutcome =
  | { ok: true; draft: TrustedContactDraft }
  | { ok: false; reason: AddContactFailureReason };

const PHONE_LABEL_PRIORITY = ['mobile', 'iphone', 'home', 'main', 'work'];

const PHONE_STRIP_REGEX = /[\s\-().]/g;

export function isRelationshipKey(value: string): value is RelationshipKey {
  return (RELATIONSHIPS as readonly string[]).includes(value);
}

export function createTrustedContactId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `tc_${Date.now().toString(36)}_${random}`;
}

export function normalizePhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(PHONE_STRIP_REGEX, '').trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return cleaned;
}

function labelPriority(label: string | undefined): number {
  if (!label) return PHONE_LABEL_PRIORITY.length;
  const index = PHONE_LABEL_PRIORITY.indexOf(label.toLowerCase());
  return index === -1 ? PHONE_LABEL_PRIORITY.length : index;
}

export function sortPhoneCandidates(phones: readonly PhoneCandidate[]): PhoneCandidate[] {
  return phones
    .map((phone, index) => ({ phone, index, priority: labelPriority(phone.label), isPrimary: Boolean(phone.isPrimary) }))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.index - b.index;
    })
    .map((entry) => entry.phone);
}

export function pickBestPhone(phones: readonly PhoneCandidate[]): string | null {
  for (const candidate of sortPhoneCandidates(phones)) {
    const number = normalizePhoneNumber(candidate.number);
    if (number) return number;
  }
  return null;
}

export function fullNameFromContact(
  parts: Pick<ContactNameParts, 'givenName' | 'middleName' | 'familyName' | 'nickname' | 'company'>,
): string {
  const built = [parts.givenName, parts.middleName, parts.familyName]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .trim();
  if (built) return built;
  if (parts.nickname) return parts.nickname;
  if (parts.company) return parts.company;
  return '';
}

export type ContactNameParts = {
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  nickname?: string | null;
  company?: string | null;
};

export function resolveContactDraft(
  input: TrustedContactInput,
  options: { existingPhoneNumbers: readonly string[]; count: number },
): AddContactOutcome {
  const name = input.name.trim();
  const phone = normalizePhoneNumber(input.phone);
  const relationship = input.relationship;

  if (!name) return { ok: false, reason: 'missing_name' };
  if (!phone) return { ok: false, reason: 'invalid_phone' };

  const duplicate = options.existingPhoneNumbers.some(
    (existing) => normalizePhoneNumber(existing) === phone,
  );
  if (duplicate) return { ok: false, reason: 'duplicate' };

  if (options.count >= TRUSTED_CONTACT_LIMIT) return { ok: false, reason: 'limit' };

  return {
    ok: true,
    draft: {
      name,
      phone,
      relationship,
      deviceContactId: input.deviceContactId ?? null,
    },
  };
}