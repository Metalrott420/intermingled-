# Android Release Runbook — Intermingled

## App Details

| Field | Value |
|---|---|
| App name | Intermingled |
| Package name | `com.intermingled.app` |
| Version | 1.0.0 |
| EAS Project ID | `600d565b-c228-43ef-9bcd-7d4c055b9151` |

---

## One-Time Setup

### Automated Submission via EAS (Recommended for future releases)

The `eas.json` `submit` block is already configured. To activate it:

1. In Google Play Console → **Setup** → **API access**, link a Google Cloud project
2. Create a service account with the **Release Manager** role
3. Download the JSON key
4. Store it as an EAS secret:
   ```sh
   eas secret:create --scope project --name GOOGLE_PLAY_SERVICE_ACCOUNT --type file --value ./key.json
   ```
5. Update `eas.json` `serviceAccountKeyPath` to reference the secret
6. Future releases: `eas submit --platform android --profile production`

---

## Manual Release Checklist (Initial Upload)

### Step 1 — Download the AAB

- Go to the EAS build page for your Expo account / project
- Wait for build status: **Finished**
- Click **Download** → save the `.aab` to your machine

### Step 2 — Upload to Google Play Console

1. Open [play.google.com/console](https://play.google.com/console) → select **Intermingled**
2. **Release** → **Testing** → **Internal testing** → **Create new release**
3. Upload the `.aab` file
4. Release name: `1.0.0`
5. Release notes: see copy below
6. **Save** → **Review release** → **Start rollout to Internal testing**

### Step 3 — Store Listing

Navigate to **Grow** → **Store presence** → **Main store listing**:

**App name** (30 chars max):
```
Intermingled
```

**Short description** (80 chars max):
```
Speed-date in live rooms, match, and chat with people nearby.
```

**Full description** (4000 chars max):
```
Intermingled is a real-time speed-dating app that puts you in live video rooms with other singles. Swipe through quick sessions, connect with people who sparks fly with, and move the conversation to private chat — all in one place.

How it works:
• Join a live matchmaking room and meet new people in timed rounds
• Like someone? Both of you have to match before a private chat opens
• Keep the conversation going with direct messages after the session ends
• Build out your profile with photos and a bio to make a strong first impression

Intermingled is designed for people who are tired of swiping in silence. Every room is a real, live moment — not just a profile browse.

Get in the room. Make a connection.
```

**Release notes** (for internal testing track):
```
Initial internal release of Intermingled. Please test the core flows: profile creation, joining a matchmaking room, liking participants, and messaging matches.
```

### Step 4 — Content Rating

Navigate to **Policy** → **App content** → **Content rating** and answer:

| Question | Answer |
|---|---|
| Primarily directed at children under 13? | No |
| Contains user-generated content (chat, profiles)? | Yes |
| Contains violence? | No |
| Contains sexual content? | No (select "Suggestive" if asked about dating context) |
| Contains profanity? | No |
| Allows users to interact with strangers? | Yes |
| Age verification required? | Yes (Stripe Identity) |

Submit — Google assigns a rating automatically.

### Step 5 — Required App Content Declarations

Also under **Policy** → **App content**:

- **Privacy policy URL**: add your privacy policy URL (required)
- **Ads**: "No ads"
- **Data safety**: declare at minimum —
  - Name, Email address (collected, shared for account)
  - Photos/videos (user-uploaded profile photos)
  - Messages (in-app chat between matches)
  - Device/App info (crash reporting)

### Step 6 — Screenshots

Google requires at least 2 phone screenshots. Capture from the running app:
- Matchmaking room view
- Profile screen
- Match/chat screen

---

## Build Command Reference

```sh
# From artifacts/flirtfest-mobile/
eas build --platform android --profile production   # queue a new production build
eas submit --platform android --profile production  # submit latest build (requires service account)
eas build:list                                       # list recent builds and their status
```
