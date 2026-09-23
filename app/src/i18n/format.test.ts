import { format, plural } from './format';

describe('format', () => {
  it('replaces named placeholders', () => {
    expect(format('Hi {name}, {count} left', { name: 'Thandi', count: 2 })).toBe('Hi Thandi, 2 left');
  });

  it('leaves unknown placeholders intact', () => {
    expect(format('Due {when}')).toBe('Due {when}');
  });
});

describe('plural', () => {
  const forms = { one: '{count} day', other: '{count} days' };

  it('chooses the singular form for one', () => {
    expect(plural(forms, 1)).toBe('1 day');
  });

  it('chooses the plural form otherwise', () => {
    expect(plural(forms, 0)).toBe('0 days');
    expect(plural(forms, 7)).toBe('7 days');
  });
});
