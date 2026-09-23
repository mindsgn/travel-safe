import { AuthSession } from '@/lib/api/auth-session';
import { createDeadmanApi, type DeadmanApi } from '@/lib/api/deadman-api';
import { createJsonStore, type JsonStore } from '@/lib/secure-storage';

export type Services = { store: JsonStore; session: AuthSession; api: DeadmanApi };

let services: Services | null = null;

/** Lazily built so background tasks (headless JS) get the same wiring as the UI. */
export function getServices(): Services {
  if (!services) {
    const store = createJsonStore();
    const session = new AuthSession(store);
    services = { store, session, api: createDeadmanApi(session) };
  }
  return services;
}

export function setServicesForTesting(next: Services | null): void {
  services = next;
}
