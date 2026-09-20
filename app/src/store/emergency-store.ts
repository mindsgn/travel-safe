import { create } from 'zustand';

import { strings } from '@/i18n/strings';
import {
  SOS_COUNTDOWN_SECONDS,
  SOS_LOCATION_UPDATE_INTERVAL_MS,
  SOS_MIN_MOVEMENT_METERS,
  buildSosAlertBody,
  buildSosUpdateBody,
  createEmergencyId,
  shouldUpdateLocation,
  type EmergencyPhase,
  type EmergencyPosition,
} from '@/lib/emergency';
import { deliverLiveUpdate, deliverSosAlert } from '@/lib/emergency-transport';

export type EmergencyState = {
  phase: EmergencyPhase;
  emergencyId: string | null;
  startedAt: number | null;
  endedAt: number | null;
  countdownEndsAt: number | null;
  phones: string[];
  lastPosition: EmergencyPosition | null;
  lastUpdateSentAt: number | null;
  lastSharedPosition: EmergencyPosition | null;
  recipientCount: number;
  alertSent: boolean;
  deliveredUpdates: number;
  error: string | null;
  activate: (phones: string[]) => void;
  cancel: () => void;
  confirm: (now?: number) => Promise<void>;
  updateLocation: (position: EmergencyPosition) => void;
  sendPendingUpdate: (now?: number) => Promise<void>;
  endEmergency: (now?: number) => void;
  reset: () => void;
};

export const useEmergencyStore = create<EmergencyState>((set, get) => ({
  phase: 'idle',
  emergencyId: null,
  startedAt: null,
  endedAt: null,
  countdownEndsAt: null,
  phones: [],
  lastPosition: null,
  lastUpdateSentAt: null,
  lastSharedPosition: null,
  recipientCount: 0,
  alertSent: false,
  deliveredUpdates: 0,
  error: null,

  activate: (phones) => {
    set((state) => {
      if (state.phase === 'active') return state;
      return {
        phase: 'counting',
        countdownEndsAt: Date.now() + SOS_COUNTDOWN_SECONDS * 1000,
        phones,
        emergencyId: null,
        startedAt: null,
        endedAt: null,
        recipientCount: 0,
        alertSent: false,
        deliveredUpdates: 0,
        lastUpdateSentAt: null,
        lastSharedPosition: null,
        error: null,
      };
    });
  },

  cancel: () => {
    set((state) =>
      state.phase === 'counting' ? { phase: 'idle', countdownEndsAt: null } : state,
    );
  },

  confirm: async (now = Date.now()) => {
    const state = get();
    if (state.phase !== 'counting') return;
    const phones = state.phones;
    const position = state.lastPosition;

    set({
      phase: 'active',
      emergencyId: createEmergencyId(),
      startedAt: now,
      countdownEndsAt: null,
    });

    const body = buildSosAlertBody({ appName: strings.appName, position, startedAt: now });
    const result = await deliverSosAlert({ phones, body });

    set((current) => ({
      recipientCount: result.succeeded,
      alertSent: result.succeeded > 0,
      lastUpdateSentAt: now,
      lastSharedPosition: position,
      error:
        result.succeeded === 0 && phones.length > 0 ? strings.emergency.active.alertFailed : null,
    }));
  },

  updateLocation: (position) => {
    set({ lastPosition: position });
  },

  sendPendingUpdate: async (now = Date.now()) => {
    const state = get();
    if (state.phase !== 'active' || !state.lastPosition) return;
    const position = state.lastPosition;

    if (
      !shouldUpdateLocation({
        now,
        lastSentAt: state.lastUpdateSentAt,
        lastSharedPosition: state.lastSharedPosition,
        currentPosition: position,
        intervalMs: SOS_LOCATION_UPDATE_INTERVAL_MS,
        minMovementMeters: SOS_MIN_MOVEMENT_METERS,
      })
    ) {
      return;
    }

    const body = buildSosUpdateBody({
      appName: strings.appName,
      position,
      startedAt: state.startedAt ?? now,
    });
    const result = await deliverLiveUpdate({ phones: state.phones, body });

    set((current) => ({
      lastUpdateSentAt: now,
      lastSharedPosition: position,
      deliveredUpdates: current.deliveredUpdates + result.succeeded,
    }));
  },

  endEmergency: (now = Date.now()) => {
    set((state) =>
      state.phase === 'active' ? { phase: 'ended', endedAt: now, countdownEndsAt: null } : state,
    );
  },

  reset: () => {
    set({
      phase: 'idle',
      emergencyId: null,
      startedAt: null,
      endedAt: null,
      countdownEndsAt: null,
      phones: [],
      lastUpdateSentAt: null,
      lastSharedPosition: null,
      recipientCount: 0,
      alertSent: false,
      deliveredUpdates: 0,
      error: null,
    });
  },
}));