# Travel Safe · Store submission notes

Everything needed to prepare the App Store and Google Play submissions. The wording here is
deliberately careful. Travel Safe notifies people; it does not contact emergency services
and cannot guarantee anyone's safety.

---

## iOS (App Store)

### Permissions and usage strings

| Permission | Info.plist key | When it's asked | Usage string |
|---|---|---|---|
| Notifications | (runtime prompt) | Onboarding, Permissions step, after an explanation | n/a |
| Location (When In Use) | `NSLocationWhenInUseUsageDescription` | Onboarding, Permissions step | "Travel Safe saves your location when you check in, so your emergency contacts know where to start looking if you miss a check-in." |
| Location (Always) | `NSLocationAlwaysAndWhenInUseUsageDescription` | Only when the user turns on Journey sharing | "With Journey sharing on, Travel Safe keeps your last known location current between check-ins. You can turn this off at any time." |
| Face ID | `NSFaceIDUsageDescription` | The first time a protected setting is opened | "Travel Safe uses Face ID to stop anyone else from changing your emergency contacts or settings." |
| Contacts | `NSContactsUsageDescription` | Normally never: the system contact picker needs no permission | "Travel Safe lets you pick an emergency contact from your address book. Only the person you choose is shared with the app." |

SMS invites use the system Messages composer, and the user must press Send. Battery level and SIM
country need no permission.

### Background location and execution

- `UIBackgroundModes`: `location` (Journey sharing only) and `processing` / `fetch` via
  `expo-background-task`.
- Background location is **opt-in** (Settings → Journey sharing), off by default, and shows the
  blue location indicator (`showsBackgroundLocationIndicator: true`). It records significant
  movement only (250 m).
- Background tasks only sync queued check-ins and refresh reminders. **The app does not rely on
  background execution to trigger alerts.** The server detects missed deadlines even when the
  phone is off.
- Reviewer note to include: *"Background location is used only when the user explicitly enables
  Journey sharing, to keep their last known location current for their chosen emergency contacts
  if they miss a scheduled check-in. It is off by default."*

### Notifications

- Local notifications only: a reminder before the deadline, a final warning, a deadline-passed
  notice, and confirmation when an offline check-in reaches the server.
- No remote push is used, so no APNs key is required for the current feature set.
- No Critical Alerts entitlement is requested.

### Privacy

- **Privacy nutrition label.** Data linked to the user:
  - **Name** (App Functionality).
  - **Precise Location** (App Functionality).
  - **Contacts**: only the names, emails and phone numbers the user enters as emergency contacts
    (App Functionality).
  - No tracking, no advertising, no third-party analytics.
- **Retention to disclose:**
  - Location history is deleted after 24 hours, except data tied to a missed check-in.
  - Emergency links expire after 30 days.
  - Deleted accounts are erased after 3 months.
- **Account deletion** is available in the app (Account → Delete account), as Guideline 5.1.1(v)
  requires.
- **Processors to list in the privacy policy:**
  - Resend (email).
  - Twilio (WhatsApp and SMS).
  - Mapbox (maps and geocoding on the emergency page).
  - The hosting provider.
- Update `PrivacyInfo.xcprivacy` (the privacy manifest) with the required-reason APIs used by
  Expo modules.

### Review considerations

- **Guideline 1.4.1 (Physical harm).** Avoid any claim that the app provides emergency response
  or guarantees safety. The description says it *notifies chosen contacts*.
- **Guideline 5.1.1.** Every permission prompt is preceded by an in-app explanation and is
  requested only when needed.
- **Guideline 2.5.4 (background modes).** Background location is justified by user-enabled
  Journey sharing.
- **Demo access.** The app is passwordless, so reviewers can onboard directly. Point the review
  build at a staging API, and add a note that alerts go only to contacts the reviewer enters.
- `ITSAppUsesNonExemptEncryption` is `false` (only standard HTTPS/TLS).

### Battery optimization

- Background sync interval: minimum 15 minutes, scheduled by iOS (often less frequent, and
  paused in Low Power Mode). The app warns the user when Low Power Mode is on.
- Journey sharing uses balanced accuracy, a 250 m distance filter, deferred updates and automatic
  pausing.
- Check-in location is a single fix: a cached fix no older than 2 minutes, or a fresh fix with
  a 4-second timeout.

---

## Android (Google Play)

### Permissions

| Permission | Purpose |
|---|---|
| `POST_NOTIFICATIONS` (13+) | Check-in reminders; requested during onboarding after an explanation |
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | Location saved with each check-in |
| `ACCESS_BACKGROUND_LOCATION` | Journey sharing only, requested separately after foreground access |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` | Visible "Journey sharing is on" notification while tracking |
| `USE_BIOMETRIC` / `USE_FINGERPRINT` | App lock for settings and contacts |
| `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` | Re-arming background sync (WorkManager) and scheduled reminders |
| `READ_CONTACTS` | Added by `expo-contacts`. If the contact picker works without it on target devices, block it with `android.blockedPermissions` to keep the permission list minimal |
| `SCHEDULE_EXACT_ALARM` | Not requested. Reminders tolerate inexact delivery by a few minutes |

### Background location and execution

- The Play Console **background location declaration** is required. Core feature: *"Users can
  opt in to Journey sharing so that, if they miss a scheduled safety check-in, their chosen
  emergency contacts receive their recent location."*
- Provide a short video showing the in-app explanation, the toggle, the system prompt and the
  foreground-service notification.
- Background sync uses WorkManager via `expo-background-task`, with the same principle as iOS:
  the server, not the phone, decides whether to alert.

### Notifications

- One notification channel, "Check-in reminders", with high importance.
- Journey sharing shows a persistent foreground-service notification while active.

### Privacy (Data safety form)

- **Collected:**
  - **Name.** Required, for app functionality.
  - **Precise location.** Optional, for app functionality.
  - **Contacts.** Only the emergency contact details the user enters, for app functionality.
- **Shared:** Emergency contacts receive the user's name, last check-in, last known location and
  address through a private link, only after a missed check-in. This is user-initiated sharing.
- Data is encrypted in transit (HTTPS). The user can request deletion in the app.
- No ads, no analytics SDKs, no data sale.

### Review considerations

- Declare the app is **not** a replacement for emergency services in the description.
- Account deletion: in-app, plus a web deletion URL for the Data safety form.
- Target API level must meet the current Play requirement. Check it at submission time.

### Battery optimization

- The app does **not** request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, which Play restricts.
- Some manufacturers (for example Samsung, Xiaomi and Huawei) aggressively kill background work.
  The app says that background refresh may be restricted and tells users to open the app
  regularly. Alerts still work because the server decides.
- Location settings match iOS (balanced accuracy, 250 m distance filter, deferred batches).

---

## Store listing

**App name:** Travel Safe

**Subtitle (iOS, 30 characters):** Check in. Stay connected.

**Short description (Play, 80 characters):**
> Check in on your schedule. Miss one, and the people you choose will know.

**Full description:**

> Travel Safe is a simple safety check-in for people who travel alone, live alone, hike, or
> work in remote places.
>
> **How it works**
> • Choose how often you'll check in, from once a day to once a year.
> • Tap Check In before each deadline. That's it.
> • If you miss a deadline, the people you've chosen get a calm message by email, WhatsApp or SMS
> with your last check-in time and last known location.
>
> **Built to be honest**
> • Your deadline is tracked on our server, so contacts can still be notified if your phone is
> lost, off, or out of battery.
> • The app tells you plainly when a check-in is only saved on your phone and hasn't reached the
> server yet.
> • Reminders before your deadline help you avoid false alarms.
>
> **Private by design**
> • You choose who is contacted and what they see.
> • Location history is deleted after 24 hours, except around a missed check-in.
> • Emergency links are private and expire.
> • Delete your account at any time.
>
> **Important:** Travel Safe notifies the people you choose. It does not contact emergency
> services, and it can't guarantee your safety or that messages will be delivered or read. In
> an emergency, contact your local emergency number.

**Keywords (iOS):** check in, safety, solo travel, lone worker, hiking, emergency contact, dead man switch, wellbeing, alone

**Category:** Lifestyle (primary), Travel (secondary). Avoid Medical.

---

## Screenshot concepts

Text-first frames on the app's calm palette (off-white `#f5f6f5` / deep teal `#1f6f5c`), each
with a large headline over a real screen from the app.

1. **"If You Don't Check In, Someone Will Know."**
   Screen: Home, showing the teal status card "You're checked in", the next deadline, and the
   contacts row with 2 contacts.
   Caption: *Pick a schedule. Pick your people.*

2. **"One Tap. You're Checked In."**
   Screen: the large Check In button mid-press, with the success notice "Checked in. Your
   deadline is now Friday at 09:00."
   Caption: *No forms, no fuss. Just tap before your deadline.*

3. **"Missed Check-In? Your Contacts Get Notified."**
   Screen: a split frame. On the left, the email a contact receives (name, last check-in, "View
   details and map"). On the right, the emergency page with the map pin and address.
   Caption: *They see when you last checked in and where you were. Nothing more.*

Keep screenshot copy free of safety guarantees ("keeps you safe", "rescue", "24/7 monitoring").
