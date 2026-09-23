import {
  contactChannels,
  draftFromContact,
  EMPTY_DRAFT,
  nameFromContact,
  normalizeEmail,
  normalizePhone,
  pickBestPhone,
  validateContact,
} from './contacts';

describe('contact validation', () => {
  it('accepts a contact with email only', () => {
    const result = validateContact({ ...EMPTY_DRAFT, name: ' Sipho ', email: 'Sipho@Example.com' });
    expect(result).toEqual({
      ok: true,
      contact: { name: 'Sipho', email: 'sipho@example.com', phone: null, whatsapp: false },
    });
  });

  it('accepts a contact with phone only', () => {
    const result = validateContact({ ...EMPTY_DRAFT, name: 'Sipho', phone: '+27 82 123 4567' });
    expect(result.ok && result.contact.phone).toBe('+27821234567');
  });

  it('accepts a contact with both and WhatsApp', () => {
    const result = validateContact({ name: 'Sipho', email: 's@example.com', phone: '+27821234567', whatsapp: true });
    expect(result.ok && result.contact).toEqual({
      name: 'Sipho',
      email: 's@example.com',
      phone: '+27821234567',
      whatsapp: true,
    });
  });

  it('requires a name', () => {
    const result = validateContact({ ...EMPTY_DRAFT, email: 's@example.com' });
    expect(result).toEqual({ ok: false, errors: { name: 'missing_name' } });
  });

  it('requires at least an email or a phone number', () => {
    const result = validateContact({ ...EMPTY_DRAFT, name: 'Sipho' });
    expect(result).toEqual({ ok: false, errors: { form: 'missing_channel' } });
  });

  it('reports invalid email and phone', () => {
    const result = validateContact({ name: 'Sipho', email: 'nope', phone: '12', whatsapp: false });
    expect(result).toEqual({ ok: false, errors: { email: 'invalid_email', phone: 'invalid_phone' } });
  });

  it('requires a phone number for WhatsApp', () => {
    const result = validateContact({ name: 'Sipho', email: 's@example.com', phone: '', whatsapp: true });
    expect(result).toEqual({ ok: false, errors: { phone: 'whatsapp_requires_phone' } });
  });

  it('rejects overly long names', () => {
    const result = validateContact({ ...EMPTY_DRAFT, name: 'x'.repeat(101), email: 's@example.com' });
    expect(result.ok).toBe(false);
  });
});

describe('normalizers', () => {
  it('normalizes email', () => {
    expect(normalizeEmail('  A@B.co ')).toBe('a@b.co');
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('a@b')).toBe('invalid');
  });

  it('normalizes phone numbers to E.164', () => {
    expect(normalizePhone('+27 (82) 123-4567')).toBe('+27821234567');
    expect(normalizePhone('0044 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhone('082 123 4567', '27')).toBe('+27821234567');
    expect(normalizePhone('082 123 4567')).toBe('invalid');
    expect(normalizePhone('   ')).toBeNull();
  });
});

describe('contact helpers', () => {
  it('lists the channels a contact will be reached on', () => {
    expect(contactChannels({ email: 'a@b.co', phone: null, whatsapp: false })).toEqual(['email']);
    expect(contactChannels({ email: null, phone: '+27821234567', whatsapp: false })).toEqual(['sms']);
    expect(contactChannels({ email: 'a@b.co', phone: '+27821234567', whatsapp: true })).toEqual([
      'email',
      'whatsapp',
    ]);
  });

  it('round-trips a saved contact into an editable draft', () => {
    expect(draftFromContact({ name: 'A', email: null, phone: '+27821234567', whatsapp: true })).toEqual({
      name: 'A',
      email: '',
      phone: '+27821234567',
      whatsapp: true,
    });
  });

  it('picks the best phone number from an address-book entry', () => {
    expect(
      pickBestPhone([
        { label: 'work', number: '+27110000000' },
        { label: 'mobile', number: '+27820000000' },
      ]),
    ).toBe('+27820000000');
    expect(pickBestPhone([{ label: 'home', number: '1' }, { number: '2', isPrimary: true }])).toBe('2');
    expect(pickBestPhone([{ label: 'mobile', number: '  ' }])).toBeNull();
  });

  it('builds a display name from contact parts', () => {
    expect(nameFromContact({ fullName: ' Thandi M ' })).toBe('Thandi M');
    expect(nameFromContact({ givenName: 'Thandi', familyName: 'Mokoena' })).toBe('Thandi Mokoena');
    expect(nameFromContact({ company: 'Acme' })).toBe('Acme');
    expect(nameFromContact({})).toBe('');
  });
});
