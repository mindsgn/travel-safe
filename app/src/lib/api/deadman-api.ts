import type { AuthSession, RegisterInput } from '@/lib/api/auth-session';
import type { Channel, EmergencyContact, NormalizedContact } from '@/lib/contacts';

export type SwitchState = 'inactive' | 'armed' | 'triggered' | 'archived';

export type SwitchStatus = {
  state: SwitchState;
  check_in_interval_days: number;
  last_check_in_at: string | null;
  next_deadline_at: string | null;
  seconds_remaining: number | null;
  deadline_passed: boolean;
  contact_count: number;
  server_time: string;
};

export type NotificationStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'failed' | 'cancelled';

export type LatestEvent = {
  id: string;
  status: 'triggered' | 'resolved';
  deadline_at: string;
  triggered_at: string;
  resolved_at: string | null;
  notifications: {
    id: string;
    channel: Channel;
    recipient_name: string;
    status: NotificationStatus;
    failure_reason: string | null;
    sent_at: string | null;
  }[];
};

export type FullStatus = SwitchStatus & { latest_event: LatestEvent | null };

export type Profile = {
  id: string;
  name: string;
  timezone: string | null;
  check_in_interval_days: number;
  created_at: string;
  updated_at: string;
};

export type LocationSample = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  recordedAt: string;
};

export type DeviceState = { batteryLevel: number | null; lowPowerMode: boolean | null };

export type CheckInPayload = {
  clientId: string;
  occurredAt: string;
  location: LocationSample | null;
  device: DeviceState | null;
};

export type CheckInResponse = {
  check_in: { id: string; client_id: string; received_at: string; deadline_at: string };
  created: boolean;
  resolved_event_ids: string[];
  status: SwitchStatus;
};

function locationBody(sample: LocationSample) {
  return {
    latitude: sample.latitude,
    longitude: sample.longitude,
    accuracy_m: sample.accuracyM,
    recorded_at: sample.recordedAt,
  };
}

function deviceBody(device: DeviceState | null) {
  return device ? { battery_level: device.batteryLevel, low_power_mode: device.lowPowerMode } : null;
}

export function createDeadmanApi(session: AuthSession) {
  const call = session.authorizedRequest.bind(session);
  return {
    register: (input: RegisterInput) => session.register(input),
    getProfile: () => call<Profile>('/api/v1/me'),
    updateProfile: (patch: { name?: string; timezone?: string; check_in_interval_days?: number }) =>
      call<Profile>('/api/v1/me', { method: 'PATCH', body: patch }),
    deleteProfile: () => call<{ archived: boolean; purge_after: string }>('/api/v1/me', { method: 'DELETE' }),
    logout: () => call<void>('/api/v1/auth/logout', { method: 'POST' }),

    checkIn: (payload: CheckInPayload) =>
      call<CheckInResponse>('/api/v1/check-ins', {
        method: 'POST',
        body: {
          client_id: payload.clientId,
          occurred_at: payload.occurredAt,
          location: payload.location ? locationBody(payload.location) : null,
          device: deviceBody(payload.device),
        },
      }),
    getStatus: () => call<FullStatus>('/api/v1/switch/status'),

    listContacts: () => call<{ contacts: EmergencyContact[] }>('/api/v1/contacts').then((body) => body.contacts),
    addContact: (contact: NormalizedContact) =>
      call<EmergencyContact>('/api/v1/contacts', { method: 'POST', body: contact }),
    updateContact: (id: string, contact: NormalizedContact) =>
      call<EmergencyContact>(`/api/v1/contacts/${encodeURIComponent(id)}`, { method: 'PUT', body: contact }),
    deleteContact: (id: string) => call<void>(`/api/v1/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    uploadLocations: (points: LocationSample[], source: 'foreground' | 'background', device: DeviceState | null) =>
      call<{ stored: number }>('/api/v1/locations', {
        method: 'POST',
        body: { points: points.map(locationBody), source, device: deviceBody(device) },
      }),
  };
}

export type DeadmanApi = ReturnType<typeof createDeadmanApi>;
