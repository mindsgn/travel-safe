const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Client-generated idempotency key; the backend dedupes check-ins on (user, client_id). */
export function createClientId(now: Date = new Date(), random: () => number = Math.random): string {
  let suffix = '';
  for (let index = 0; index < 16; index += 1) suffix += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `ci_${now.getTime().toString(36)}_${suffix}`;
}
