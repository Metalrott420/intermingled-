# iOS Release Runbook — Intermingled

## App Details

| Field | Value |
|---|---|
| App name | Intermingled |
| Bundle ID | `com.intermingled.app` |
| Version | 1.0.0 |
| EAS Project ID | `600d565b-c228-43ef-9bcd-7d4c055b9151` |

---

## Prerequisites

1. **Apple Developer account** — enroll at [developer.apple.com](https://developer.apple.com/) ($99/year)
2. **App record created** — log in to [App Store Connect](https://appstoreconnect.apple.com/) → My Apps → **+** → New App → fill in name ("Intermingled"), bundle ID (`com.intermingled.app`), and SKU
3. **EAS CLI** — already installed globally (`eas --version`)

---

## One-Time Credential Setup

Apple distribution certificates and provisioning profiles must be provisioned once before non-interactive builds work.

From `artifacts/flirtfest-mobile/`, run interactively (requires Apple ID login):

```sh
eas credentials --platform ios
```

Select **Production** profile → **Manage credentials** → let EAS auto-generate the **Distribution Certificate** and **App Store Provisioning Profile**. EAS stores these on its servers so future CI/non-interactive builds work automatically.

After this step, you can build non-interactively:

```sh
EAS_NO_VCS=1 eas build --platform ios --profile production --non-interactive
```

---

## Build Command Reference

```sh
# From artifacts/flirtfest-mobile/

# One-time: set up credentials (interactive, needs Apple ID)
eas credentials --platform ios

# Queue a production build
EAS_NO_VCS=1 eas build --platform ios --profile production --non-interactive

# List recent builds and their status
eas build:list --platform ios

# Submit the latest finished build to App Store Connect
eas submit --platform ios --profile production
```

---

## Manual Submission Checklist (Initial Upload)

### Step 1 — Download the IPA (if submitting manually)

- Go to [expo.dev](https://expo.dev/) → your project → **Builds**
- Wait for build status: **Finished**
- Click **Download** → save the `.ipa` to your Mac

### Step 2 — Upload via EAS (recommended) or Transporter

**Via EAS (easiest):**
```sh
eas submit --platform ios --profile production
```
EAS asks for your Apple ID and uploads automatically to App Store Connect.

**Via Apple Transporter (manual):**
1. Install [Transporter](https://apps.apple.com/us/app/transporter/id1450874784) on your Mac
2. Open Transporter → sign in with Apple ID → drag in the `.ipa`
3. Click **Deliver**

### Step 3 — App Store Connect Setup

Navigate to [App Store Connect](https://appstoreconnect.apple.com/) → your app:

**App name** (30 chars max):
```
Intermingled
```

**Subtitle** (30 chars max):
```
Speed-date and meet people
```

**Description**:
```
Intermingled is a real-time speed-dating app that puts you in live rooms with other singles. Join quick sessions, match with people you connect with, and move the conversation to private chat — all in one place.

How it works:
• Join a live matchmaking room and meet new people in timed rounds
• Like someone? Both of you have to match before a private chat opens
• Keep the conversation going with direct messages after the session ends
• Build out your profile with photos and a bio to make a strong first impression

Intermingled is designed for people who are tired of swiping in silence. Every room is a real, live moment — not just a profile browse.

Get in the room. Make a connection.
```

**Keywords** (100 chars max):
```
dating,speed date,meet people,singles,matchmaking,chat,rooms,live,connect
```

**Support URL**: your support/contact page  
**Privacy Policy URL**: your privacy policy URL (required)

### Step 4 — Age Rating

Under **App Information** → **Content Rights** → **App Rating**:

| Category | Level |
|---|---|
| Simulated Gambling | None |
| Sexual Content / Nudity | None |
| Profanity / Crude Humor | None |
| Horror / Fear Themes | None |
| Medical / Treatment Info | None |
| Alcohol / Tobacco / Drugs | None |
| Cartoon / Fantasy Violence | None |
| User-Generated Content | Yes |

This results in a **17+** rating due to unrestricted web access and user-generated content (dating app context).

### Step 5 — Privacy Nutrition Labels

Under **App Privacy** → **Privacy Practices**, declare:

- **Contact Info** (Name, Email) — collected, used for app functionality, linked to identity
- **Photos or Videos** — collected (profile photos), linked to identity
- **Messages** — collected (in-app chat), linked to identity, not used for tracking
- **Identifiers** (User ID) — collected, used for app functionality

### Step 6 — Screenshots

Required: at least one screenshot per supported device size. Minimum set:
- **6.7" Display** (iPhone 15 Pro Max): 1290 × 2796 px
- **6.5" Display** (iPhone 14 Pro Max): 1284 × 2778 px
- **5.5" Display** (iPhone 8 Plus): 1242 × 2208 px (required for older devices)

Capture from a running simulator or device:
- Matchmaking room view
- Profile screen
- Match / chat screen

### Step 7 — Submit for Review

1. Select the uploaded build under **Build**
2. Fill in export compliance (encryption: No, per `ITSAppUsesNonExemptEncryption: false` in `app.json`)
3. Click **Add for Review** → **Submit to App Review**

Apple review typically takes 24–48 hours.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `Cannot find 'expo-modules-autolinking' package` | Fixed — `node-linker=hoisted` in root `.npmrc` |
| `ITSAppUsesNonExemptEncryption` warning | Fixed — declared `false` in `app.json` `ios.infoPlist` |
| `Distribution Certificate is not validated for non-interactive builds` | Run `eas credentials --platform ios` once interactively |
| `Credentials are not set up` | Same as above — requires Apple Developer account |
