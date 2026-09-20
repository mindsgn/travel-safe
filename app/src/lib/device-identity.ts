export type DeviceCodeStore = {
  get(): string | null;
  set(code: string): void;
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomDeviceToken(random: () => number = Math.random): string {
  let token = '';
  for (let index = 0; index < 8; index += 1) {
    token += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)] ?? 'X';
  }
  return token;
}

export function createDeviceCode(random: () => number = Math.random): string {
  return `TS-${randomDeviceToken(random)}`;
}

export function isDeviceCode(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^TS-[A-Z0-9]{8}$/.test(value);
}

export function createMemoryDeviceCodeStore(initial: string | null = null): DeviceCodeStore {
  let value = initial;
  return {
    get: () => value,
    set: (code) => {
      value = code;
    },
  };
}

export function loadOrCreateDeviceCode(
  store: DeviceCodeStore,
  create: () => string = createDeviceCode,
): string {
  const existing = store.get();
  if (isDeviceCode(existing)) return existing;
  const code = create();
  store.set(code);
  return code;
}
