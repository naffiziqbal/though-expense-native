# ThoughtExpense — Mobile App (React Native + Expo)

Native mobile client for ThoughtExpense, the natural-language expense tracker. Feature parity with the web client (`../client`), talking to the Express API in `../server`.

## Features

- **Quick Log** — type expenses in plain language (`coffee 120, uber 250`), live local preview, AI parse + categorize on save
- **Dashboard** — monthly total, budget donut, safe-to-spend, top category, recent transactions, budget alerts & AI insight notifications
- **Expenses** — paginated list, category/date filters (free tier limited to last 3 months), inline edit/delete, CSV/PDF export via native share sheet (Premium)
- **Insights** — spending donut (top 3 + others), category bars, AI observations, generate on demand
- **Budget** — monthly limit, AI-parsed category budgets (`Food 500, Rent 2000`), per-category progress with drill-down, history
- **Profile** — avatar upload, currency, change password, light/dark/system theme, premium

## Stack

- Expo SDK 57 / React Native 0.86 / expo-router (file-based navigation in `src/app`)
- zustand (+ AsyncStorage persistence), axios, expo-secure-store (JWT), react-native-svg (charts)
- Design tokens ported from `../client/design-token.md` (`src/constants/theme.ts`)

## Setup

```bash
cd app
npm install
```

Point the app at your backend in `.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:7100   # your machine's LAN IP for a physical device,
                                            # http://10.0.2.2:7100 for Android emulator
EXPO_PUBLIC_SPACES_URL=https://nexustorage.sgp1.digitaloceanspaces.com
```

Run in development:

```bash
npx expo start           # scan QR with Expo Go, or press a / i
```

## Building the APK

APK builds are configured through **EAS Build** (`eas.json` — all Android profiles use `buildType: "apk"`).

```bash
npm install -g eas-cli
eas login                          # one-time (expo.dev account)
eas build -p android --profile preview     # cloud build → downloadable .apk
```

The `preview` and `production` profiles bake in `EXPO_PUBLIC_API_URL=https://api.thoughtexpense.nafiziqbal.com` — change that in `eas.json` to match your deployed API before building.

### Local APK build (no cloud)

Requires JDK 17 and the Android SDK (neither is currently installed on this machine):

```bash
brew install --cask zulu@17 android-commandlinetools
# accept licenses + install platform/build tools, set ANDROID_HOME
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
# output: android/app/build/outputs/apk/release/app-release.apk
```

Or `eas build -p android --profile preview --local` once JDK + SDK are present.

## Notes / deviations from the web client

- **Receipt OCR** (tesseract.js) is web-only; the native app omits scan-to-text for now (server has no OCR endpoint).
- **Password reset links** in email open the web frontend (`FRONTEND_URL`); the app covers the request-reset step.
- Web's `DASHBOARD_REFRESH_EVENT` is replaced by refetch-on-focus (`useFocusEffect`).
- Exports save directly to disk instead of opening a share sheet. Android writes to a folder granted once via the Storage Access Framework (picker defaults to Downloads, grant is remembered); iOS writes to the app's Documents directory, which `UIFileSharingEnabled` exposes in Files › On My iPhone › ThoughtExpense.
