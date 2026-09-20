# Amafa App Agent Guide

Scope: this file applies to the entire `app/` workspace, including Android, iOS, shared React Native code, tests, and e2e flows.

## Project Map
- `app/` contains Expo Router screens and route layouts.
- `components/` contains reusable UI, from `base` primitives up through `molecules`, `organisms`, and `templates`.
- `lib/` contains business logic, pure helpers, Firebase adapters, sync, notifications, and other testable utilities.
- `db/` contains the SQLite schema, client, and repository layer.
- `store/` contains shared client state.
- `i18n/` contains translations and localization helpers.
- `e2e/` contains Maestro YAML scenarios for feature coverage.

## Hard Rules
- Every implemented function must have unit test coverage.
- Every user-facing feature must have e2e coverage.
- All user-visible copy must come from `i18n/`; do not hardcode new UI strings.
- Every new interactive control or critical screen state must expose a stable `testID` for e2e.
- Prefer pure, testable helpers over logic embedded directly in screens or components.
- Do not introduce new `any`, `ts-ignore`, or `eslint-disable` usage unless there is no safe alternative and the boundary is tightly isolated.
- Do not commit secrets, credentials, keystore data, private URLs, or release passwords into source-controlled files.
- Do not hand-edit generated or vendored output such as `node_modules/`, `.expo/`, `android/build/`, `ios/Pods/`, or other build artifacts.

## Architecture
- Use Expo Router conventions for navigation; route files and folder names define the screen structure.
- Use the `@/` import alias consistently instead of long relative paths.
- Keep screens thin: orchestration belongs in routes, reusable behavior belongs in `lib/`, and shared UI belongs in `components/`.
- Keep database writes and higher-level persistence in `db/repository.ts`; keep schema changes in `db/schema.ts` and add matching migrations in `drizzle/`.
- Keep platform-specific integration in the native layer or Expo config, not scattered through feature screens.
- Preserve the existing component hierarchy when adding UI: `base` for primitives, `molecules` for small composites, `organisms` for larger assemblies, and `templates` for screen-level patterns.

## Testing
- Put unit tests next to the logic they exercise, usually as `*.test.ts` files under `lib/` or `i18n/`.
- If you add testable logic outside the current Jest roots, either extract it into `lib/` or update Jest config deliberately so the new function is still covered.
- Add or update Maestro scenarios in `e2e/` for every new feature, major flow, or navigation path.
- Prefer stable selectors in e2e tests; avoid relying on fragile copy when a `testID` can be added.
- Update translation tests whenever locale keys or translation trees change.
- Update or extend unit tests when changing date math, search, sync, notifications, Firebase adapters, data mappers, or DB repository logic.

## Runtime
- Preserve the startup order in `app/_layout.tsx`: fonts, migrations, seeding, Firebase setup, notifications, background task registration, then splash hide.
- Keep notification, sync, Firebase, and background-task behavior in `lib/` helpers so it stays testable.
- Keep Android permissions, iOS usage strings, app scheme, and Expo plugin config aligned with `app.json` and the native manifests.
- Treat signing config and other release-only values as sensitive; do not duplicate or move them into new committed files.

## Feature Areas
- Current user-facing areas include onboarding, dashboard, assets, components, categories, locations, custodians, bookings, kits, import/export, lock, maintenance, warranty, camera, and account/settings.
- When changing one of those areas, update the related screen, helper, unit tests, and e2e flow together.
- When changing labels, IDs, or navigation, check any affected Maestro flow before finishing.

## Working Style
- Make the smallest change that fixes the root cause.
- Favor refactors that increase testability over one-off patches.
- Remove debug logging before finishing unless the logging is part of intentional error handling.
- If a change touches routing, storage, permissions, or startup behavior, audit the surrounding screens and tests before closing the task.
- at the end explain what changes were made and why.
