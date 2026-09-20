import {
  DEFAULT_RELATIONSHIP,
  TRUSTED_CONTACT_LIMIT,
  createTrustedContactId,
  fullNameFromContact,
  isRelationshipKey,
  normalizePhoneNumber,
  pickBestPhone,
  resolveContactDraft,
  sortPhoneCandidates,
} from '@/lib/trusted-contacts';

describe('normalizePhoneNumber', () => {
  it('strips spaces, dashes, dots and parens', () => {
    expect(normalizePhoneNumber('+27 82 123 4567')).toBe('+27821234567');
    expect(normalizePhoneNumber('(021) 555-1234')).toBe('(021)555-1234'.replace(/[\s\-().]/g, ''));
  });

  it('keeps a leading plus and returns null for too-short numbers', () => {
    expect(normalizePhoneNumber('+12 3 456')).toBeNull();
    expect(normalizePhoneNumber('1234567')).toBe('1234567');
  });

  it('rejects empty and whitespace-only input', () => {
    expect(normalizePhoneNumber('')).toBeNull();
    expect(normalizePhoneNumber('   ')).toBeNull();
    expect(normalizePhoneNumber(null)).toBeNull();
    expect(normalizePhoneNumber(undefined)).toBeNull();
  });
});

describe('sortPhoneCandidates', () => {
  it('sorts primary first, then preferred labels in order', () => {
    const sorted = sortPhoneCandidates([
      { label: 'work', number: '1' },
      { label: 'mobile', number: '2' },
      { label: 'home', number: '3' },
    ]);
    expect(sorted.map((phone) => phone.number)).toEqual(['2', '3', '1']);
  });

  it('keeps label order stable for equal priorities', () => {
    const sorted = sortPhoneCandidates([
      { label: 'other', number: 'a' },
      { label: 'other', number: 'b' },
    ]);
    expect(sorted.map((phone) => phone.number)).toEqual(['a', 'b']);
  });
});

describe('pickBestPhone', () => {
  it('returns the best valid number', () => {
    expect(pickBestPhone([{ label: 'home', number: '123' }, { label: 'mobile', number: '+27821234567' }])).toBe(
      '+27821234567',
    );
  });

  it('skips empty entries and returns null when nothing is valid', () => {
    expect(pickBestPhone([{ label: 'home', number: '' }, { label: 'other', number: '12 34' }])).toBeNull();
    expect(pickBestPhone([])).toBeNull();
  });
});

describe('fullNameFromContact', () => {
  it('joins given, middle and family names', () => {
    expect(
      fullNameFromContact({ givenName: 'Thandi', middleName: 'N.', familyName: 'Molefe' }),
    ).toBe('Thandi N. Molefe');
  });

  it('falls back to nickname then company then empty', () => {
    expect(fullNameFromContact({ nickname: 'TJ' })).toBe('TJ');
    expect(fullNameFromContact({ company: 'Amafa Co' })).toBe('Amafa Co');
    expect(fullNameFromContact({})).toBe('');
    expect(fullNameFromContact({ givenName: '  ', familyName: null })).toBe('');
  });
});

describe('isRelationshipKey / createTrustedContactId', () => {
  it('guards relationship keys', () => {
    expect(isRelationshipKey('family')).toBe(true);
    expect(isRelationshipKey('partner')).toBe(true);
    expect(isRelationshipKey('not-a-key')).toBe(false);
  });

  it('creates unique-looking ids', () => {
    const a = createTrustedContactId();
    const b = createTrustedContactId();
    expect(a).toMatch(/^tc_[0-9a-z]+_[0-9a-z]+$/);
    expect(a).not.toBe(b);
  });
});

describe('resolveContactDraft', () => {
  const base = { name: 'Alex', phone: '+27 82 123 4567', relationship: DEFAULT_RELATIONSHIP };
  const options = { existingPhoneNumbers: [], count: 0 };

  it('accepts a valid draft and trims the name', () => {
    const outcome = resolveContactDraft({ ...base, name: '  Alex  ' }, options);
    expect(outcome).toEqual({
      ok: true,
      draft: {
        name: 'Alex',
        phone: '+27821234567',
        relationship: 'family',
        deviceContactId: null,
      },
    });
  });

  it('rejects a missing name', () => {
    const outcome = resolveContactDraft({ ...base, name: '   ' }, options);
    expect(outcome).toEqual({ ok: false, reason: 'missing_name' });
  });

  it('rejects an invalid phone', () => {
    const outcome = resolveContactDraft({ ...base, phone: '123' }, options);
    expect(outcome).toEqual({ ok: false, reason: 'invalid_phone' });
  });

  it('rejects a duplicate phone even when formatted differently', () => {
    const outcome = resolveContactDraft(base, {
      existingPhoneNumbers: ['+27821234567'], // stored normalized form
      count: 0,
    });
    expect(outcome).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('rejects when the contact limit is reached', () => {
    const outcome = resolveContactDraft(base, {
      existingPhoneNumbers: ['+27111111111'],
      count: TRUSTED_CONTACT_LIMIT,
    });
    expect(outcome).toEqual({ ok: false, reason: 'limit' });
  });

  it('keeps a provided device contact id', () => {
    const outcome = resolveContactDraft(
      { ...base, deviceContactId: 'device-42' },
      options,
    );
    expect(outcome).toEqual({
      ok: true,
      draft: { name: 'Alex', phone: '+27821234567', relationship: 'family', deviceContactId: 'device-42' },
    });
  });
});