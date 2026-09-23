import { createStore, type StoreApi } from 'zustand/vanilla';

import type { AuthSession } from '@/lib/api/auth-session';
import type { DeadmanApi, DeviceState, FullStatus, LocationSample } from '@/lib/api/deadman-api';
import type { PendingCheckIn } from '@/lib/check-in-queue';
import { performCheckIn, type CheckInOutcome } from '@/lib/check-in-service';
import type { EmergencyContact, NormalizedContact } from '@/lib/contacts';
import { DEFAULT_INTERVAL_DAYS } from '@/lib/intervals';
import type { JsonStore } from '@/lib/secure-storage';
import { classifySyncError, reminderTarget, syncWithServer, type SyncError } from '@/lib/sync';

export const APP_STATE_KEY = 'app-state';

export type SecuritySettings = { protectSettings: boolean; protectCheckIn: boolean };

export type PersistedState = {
  name: string | null;
  onboardingComplete: boolean;
  intervalDays: number;
  profileCreatedAt: string | null;
  status: FullStatus | null;
  statusFetchedAt: string | null;
  lastSyncAt: string | null;
  pending: PendingCheckIn[];
  contacts: EmergencyContact[];
  security: SecuritySettings;
  journeySharing: boolean;
};

export const INITIAL_PERSISTED: PersistedState = {
  name: null,
  onboardingComplete: false,
  intervalDays: DEFAULT_INTERVAL_DAYS,
  profileCreatedAt: null,
  status: null,
  statusFetchedAt: null,
  lastSyncAt: null,
  pending: [],
  contacts: [],
  security: { protectSettings: true, protectCheckIn: false },
  journeySharing: false,
};

export type ReminderPort = {
  schedule: (deadline: Date, intervalDays: number, now: Date) => Promise<unknown>;
  cancel: () => Promise<unknown>;
  notifySynced: (deadline: Date, now: Date) => Promise<unknown>;
};

export type AppStoreDeps = {
  store: JsonStore;
  api: DeadmanApi;
  session: Pick<AuthSession, 'hasCredentials' | 'clear'>;
  reminders: ReminderPort;
  captureLocation: () => Promise<LocationSample | null>;
  readDevice: () => Promise<DeviceState | null>;
  now?: () => Date;
  timezone?: () => string | undefined;
};

export type AppState = PersistedState & {
  hydrated: boolean;
  registered: boolean;
  syncing: boolean;
  checkingIn: boolean;
  syncError: SyncError | null;
  contactsError: SyncError | null;

  hydrate: () => Promise<void>;
  register: (name: string) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  setIntervalDays: (days: number) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  checkIn: () => Promise<CheckInOutcome>;
  sync: (options?: { notifyConfirmed?: boolean }) => Promise<SyncError | null>;
  loadContacts: () => Promise<void>;
  addContact: (contact: NormalizedContact) => Promise<EmergencyContact>;
  updateContact: (id: string, contact: NormalizedContact) => Promise<EmergencyContact>;
  removeContact: (id: string) => Promise<void>;
  updateSecurity: (patch: Partial<SecuritySettings>) => Promise<void>;
  setJourneySharing: (enabled: boolean) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const PERSISTED_KEYS = Object.keys(INITIAL_PERSISTED) as (keyof PersistedState)[];

function pickPersisted(state: AppState): PersistedState {
  const out: Record<string, unknown> = {};
  for (const key of PERSISTED_KEYS) out[key] = state[key];
  return out as PersistedState;
}

function defaultTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function createAppStore(deps: AppStoreDeps): StoreApi<AppState> {
  const now = deps.now ?? (() => new Date());
  const timezone = deps.timezone ?? defaultTimezone;
  let writes: Promise<void> = Promise.resolve();

  return createStore<AppState>()((set, get) => {
    function persist(): Promise<void> {
      const snapshot = pickPersisted(get());
      writes = writes.then(() => deps.store.set(APP_STATE_KEY, snapshot)).catch(() => undefined);
      return writes;
    }

    async function update(patch: Partial<AppState>): Promise<void> {
      set(patch);
      await persist();
    }

    async function applyReminders(status: FullStatus | null): Promise<void> {
      const target = reminderTarget(status);
      try {
        if (target) await deps.reminders.schedule(target.deadline, target.intervalDays, now());
        else await deps.reminders.cancel();
      } catch {
        // Notification delivery can fail (e.g. permission revoked); home shows the health warning.
      }
    }

    async function refreshContactCount(status: FullStatus | null): Promise<void> {
      if (!status) return;
      await update({ status: { ...status, contact_count: get().contacts.length } });
    }

    return {
      ...INITIAL_PERSISTED,
      hydrated: false,
      registered: false,
      syncing: false,
      checkingIn: false,
      syncError: null,
      contactsError: null,

      async hydrate() {
        const [saved, registered] = await Promise.all([
          deps.store.get<Partial<PersistedState>>(APP_STATE_KEY).catch(() => null),
          deps.session.hasCredentials().catch(() => false),
        ]);
        set({ ...INITIAL_PERSISTED, ...saved, registered, hydrated: true });
      },

      async register(name) {
        const trimmed = name.trim();
        if (get().registered) {
          await get().updateName(trimmed);
          return;
        }
        await deps.api.register({ name: trimmed, intervalDays: get().intervalDays, timezone: timezone() });
        await update({ name: trimmed, registered: true, profileCreatedAt: now().toISOString() });
      },

      async updateName(name) {
        const profile = await deps.api.updateProfile({ name: name.trim() });
        await update({ name: profile.name, profileCreatedAt: profile.created_at });
      },

      async setIntervalDays(days) {
        if (get().registered) {
          await deps.api.updateProfile({ check_in_interval_days: days });
          await update({ intervalDays: days });
          await get().sync();
        } else {
          await update({ intervalDays: days });
        }
      },

      async completeOnboarding() {
        await update({ onboardingComplete: true });
      },

      async checkIn() {
        set({ checkingIn: true });
        try {
          const { outcome, queue } = await performCheckIn(get().pending, {
            now,
            captureLocation: deps.captureLocation,
            readDevice: deps.readDevice,
            send: deps.api.checkIn,
          });
          if (outcome.kind === 'synced') {
            const status: FullStatus = { ...outcome.response.status, latest_event: get().status?.latest_event ?? null };
            const at = now().toISOString();
            await update({ pending: queue, status, statusFetchedAt: at, lastSyncAt: at, syncError: null });
            await applyReminders(status);
            // Pick up the resolved alert, if this check-in ended one.
            if (outcome.response.resolved_event_ids.length > 0) void get().sync();
          } else {
            await update({
              pending: queue,
              syncError: outcome.kind === 'local' ? outcome.reason : get().syncError,
            });
          }
          return outcome;
        } finally {
          set({ checkingIn: false });
        }
      },

      async sync(options = {}) {
        if (!get().registered) return null;
        set({ syncing: true });
        try {
          const result = await syncWithServer(get().pending, {
            send: deps.api.checkIn,
            getStatus: deps.api.getStatus,
            now,
          });
          const patch: Partial<AppState> = { pending: result.queue, syncError: result.error };
          if (result.status) {
            patch.status = result.status;
            patch.statusFetchedAt = result.fetchedAt?.toISOString() ?? null;
            patch.lastSyncAt = patch.statusFetchedAt;
            patch.intervalDays = result.status.check_in_interval_days;
          }
          await update(patch);
          if (result.status) {
            await applyReminders(result.status);
            const target = reminderTarget(result.status);
            if (options.notifyConfirmed && result.confirmedCount > 0 && target) {
              await deps.reminders.notifySynced(target.deadline, now()).catch(() => undefined);
            }
          }
          return result.error;
        } finally {
          set({ syncing: false });
        }
      },

      async loadContacts() {
        if (!get().registered) return;
        try {
          const contacts = await deps.api.listContacts();
          await update({ contacts, contactsError: null });
          await refreshContactCount(get().status);
        } catch (error) {
          set({ contactsError: classifySyncError(error) });
        }
      },

      async addContact(contact) {
        const created = await deps.api.addContact(contact);
        await update({ contacts: [...get().contacts, created] });
        await refreshContactCount(get().status);
        return created;
      },

      async updateContact(id, contact) {
        const updated = await deps.api.updateContact(id, contact);
        await update({ contacts: get().contacts.map((item) => (item.id === id ? updated : item)) });
        return updated;
      },

      async removeContact(id) {
        await deps.api.deleteContact(id);
        await update({ contacts: get().contacts.filter((item) => item.id !== id) });
        await refreshContactCount(get().status);
      },

      async updateSecurity(patch) {
        await update({ security: { ...get().security, ...patch } });
      },

      async setJourneySharing(enabled) {
        await update({ journeySharing: enabled });
      },

      async deleteAccount() {
        await deps.api.deleteProfile();
        await deps.reminders.cancel().catch(() => undefined);
        await deps.session.clear();
        await deps.store.remove(APP_STATE_KEY);
        set({ ...INITIAL_PERSISTED, registered: false, syncError: null, contactsError: null });
      },
    };
  });
}
