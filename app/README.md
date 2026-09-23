# Deadman Switch · Mobile app

Expo React Native app for **Deadman Switch**, a personal safety check-in. You check in with one
tap on a schedule you choose. If you miss a deadline, the backend notifies your emergency
contacts with your last known location.

Built with Expo SDK 57, React Native 0.86 (New Architecture), React 19, TypeScript and Zustand.

## Features

- **Onboarding.** It walks through the problem and solution, your name, permissions (what each is
  for, why, and what happens if you say no), optional emergency contacts, and the check-in
  interval (1 day to 1 year), ending with a first check-in.
- **Home.** It shows your status, last check-in, next deadline, interval, contacts, location
  status, a large Check In button, device health warnings, and the latest alert with
  per-contact delivery status.
- **Honest sync.** "Checked in" appears only after the server confirms. Offline check-ins are
  saved on the phone, clearly labelled as not yet sent, and retried on launch, on return to the
  foreground, in the background, or with "Send now".
- **Reminders.** Local notifications fire before the deadline (a reminder and a final warning)
  and at the deadline. They are rescheduled after every sync.
- **Contacts.** You can add, edit, view and remove contacts. The system picker shares only the
  chosen person, so the app never reads your address book. A contact needs an email, a phone
  number or both, plus an optional WhatsApp flag. You can also send an SMS invite from your
  own phone.
- **Account.** It covers your name, interval, permissions, journey sharing (optional background
  location), security (Face ID, fingerprint or passcode for settings, and optionally for check-in),
  and account deletion.

## Project structure

```
src/
  app/            Expo Router routes: onboarding/, (home)/, contacts/, settings/
  components/     UI building blocks (check-in button, status card, contact form…)
  hooks/          Screen hooks (permissions, health, foreground sync)
  i18n/           strings.ts: all user-visible copy
  lib/            Pure, tested logic: API client, auth session, offline queue, sync,
                  reminders, permissions, location, device state, secure storage
  store/          Zustand app store (persisted to the Keychain / Keystore)
  tasks.ts        Background task definitions (sync + journey location)
e2e/              Maestro flows (onboarding, check-in, offline check-in, contacts, account)
```

Keep screens thin: put logic in `lib/`, copy in `i18n/strings.ts`, and a stable `testID` on
every control. See [AGENTS.md](./AGENTS.md).

## Getting started

```bash
cp .env.example .env     # EXPO_PUBLIC_API_BASE_URL, reminder offsets
yarn install
npx expo prebuild --clean
npx expo run:ios         # or: npx expo run:android
```

A development build is required (background tasks, secure storage and local authentication
don't fully work in Expo Go). Run the backend first; see [backend/README.md](../backend/README.md).

## Tests

```bash
npx tsc --noEmit
yarn lint
yarn test
maestro test e2e/        # needs a running backend and a dev build on a simulator/emulator
```

`e2e/check-in-offline.yaml` toggles airplane mode, which Maestro supports only on Android.

## Decisions

- **Storage.** All local data (tokens, profile, contacts cache, offline queue) is chunked JSON in
  `expo-secure-store` with `AFTER_FIRST_UNLOCK`, so background tasks can read it while the phone
  is locked. Nothing is kept in AsyncStorage, and there is no local database.
- **Authentication** is passwordless and device-bound. The account is created at the onboarding
  Name step, because contacts are stored server-side and the server must know you before it can
  watch your deadline. That step needs a connection and shows a clear error if you're offline.
- **Permissions requested:** notifications and foreground location during onboarding, background
  location only when you turn on Journey sharing, and biometrics only when Face ID is first used.
  Contacts (system picker), SMS (composer), battery status and the SIM country (for phone number
  formatting) need no runtime permission.
- **Background sync** uses `expo-background-task` with a 15-minute minimum. The OS decides the
  real cadence. Background sync only keeps reminders and the queue current, because the server
  worker triggers the switch whether or not the phone is on.
- **Picker details on Android.** The system contact picker may need contacts access on some
  Android versions to read the chosen person's details. If that fails, the form asks you to type
  the details instead.
