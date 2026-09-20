export const LOCATION_PING_INTERVAL_MS = 60_000;

export function shouldSendLocationPing(
  lastSentAt: number | null,
  now: number,
  intervalMs = LOCATION_PING_INTERVAL_MS,
): boolean {
  if (lastSentAt == null) return true;
  return now - lastSentAt >= intervalMs;
}
