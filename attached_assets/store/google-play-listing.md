# Google Play Store Listing — Intermingled

**Package:** `com.intermingled.app`  
**EAS Project ID:** `600d565b-c228-43ef-9bcd-7d4c055b9151`  
**Last updated:** 2026-07-14

This document is the source of truth for all finalized Google Play store listing copy, asset locations, compliance answers, and the step-by-step upload checklist.

---

## 1. Finalized Store Copy

### App Name (50 chars max)
```
Intermingled
```

### Short Description (71 chars — max 80)
```
Real-time speed dating. Take the quiz, pick your role, find your match.
```

### Full Description (max 4000 chars)
```
Intermingled is a live, personality-driven speed-dating app for adults 18 and over. Instead of endlessly swiping, you spend a few minutes in a real-time session where a "chooser" anonymously ranks five "suitors" based on personality — not photos — and both sides learn something true about compatibility.

HOW IT WORKS

• Answer 7 quick personality questions before every session — your answers shape who you're ranked against.
• Choose your role: be a Chooser and pick your favourite from five anonymous suitors, or enter the Suitor pool and compete on personality alone.
• Choosers and suitors are matched in real time using live technology — no waiting, no ghosting.
• When the chooser picks, both parties are revealed to each other and a private match is created.
• Chat privately with every match you make from your Matches inbox.

WHAT MAKES INTERMINGLED DIFFERENT

→ Personality-first. Your quiz answers drive the matching algorithm, not your profile photo.
→ Live sessions. Rooms open when enough players are ready — there's genuine urgency and excitement.
→ Honest design. Suitors are anonymous until a match is made, so choices are based on conversation style, not looks.
→ 18+ verified. Every user completes a one-time government-ID check powered by Stripe Identity before entering sessions.

YOUR PROFILE

Upload photos, write a short bio, and set your dating preferences. Your profile is shown to your match after a connection is confirmed — never before.

SAFETY & PRIVACY

Intermingled is adults-only. Every account requires age verification via a government-issued ID processed securely by Stripe Identity — we receive only a pass/fail result, never your document. Users who do not meet the 18+ requirement are permanently blocked. In-app reporting and moderation tools are available on every session and conversation.

SUBSCRIPTION & FREE TIER

New users get a generous daily allowance of sessions before a subscription is needed. Premium subscribers unlock unlimited sessions, priority pool placement, and advanced match filters.

DATA & SECURITY

We use Clerk for secure authentication and Stripe for payments. Your email and date of birth are never shared with other users. Messages are retained 90 days for moderation and then deleted. Full data export and deletion are available on request at privacy@intermingled.app.

Download Intermingled and find out who you're actually compatible with.
```

### Release Notes / What's New (max 500 chars)
```
Welcome to Intermingled — this is the first public release.

• Real-time personality-based matchmaking
• 7-question compatibility quiz before every session
• Choose to be a Suitor or a Chooser each round
• Private chat with every match you make
• Age verification powered by Stripe Identity (18+ only)
• Dark, elegant UI built for late-night swiping

Feedback welcome at support@intermingled.app
```

---

## 2. Graphic Assets (this directory)

| Asset | File | Required size | Actual size | Status |
|---|---|---|---|---|
| Feature Graphic | `feature_graphic.png` | **1024 × 500 px** | 1024 × 500 px | ✅ Ready |
| Phone Screenshot 1 | `screenshot_1_quiz.png` | ≥ 320 px wide, 9:16 ratio | 768 × 1408 px | ✅ Ready |
| Phone Screenshot 2 | `screenshot_2_pool.png` | ≥ 320 px wide, 9:16 ratio | 768 × 1408 px | ✅ Ready |
| Phone Screenshot 3 | `screenshot_3_inbox.png` | ≥ 320 px wide, 9:16 ratio | 768 × 1408 px | ✅ Ready |

> **Note on screenshots:** These are high-quality rendered mockups. For production, replace them with actual device screenshots taken on a physical Android device or emulator before promoting to the production track.

### Upload steps in Play Console
1. **Store listing → Phone screenshots** — upload all three screenshot files.
2. **Store listing → Feature graphic** — upload `feature_graphic.png`.
3. **Store listing → App icon** — upload `artifacts/flirtfest-mobile/assets/images/icon.png` resized to **512 × 512 px** (required format; use `magick icon.png -resize 512x512 icon_512.png`).

---

## 3. Content Rating Questionnaire

**Location in Play Console:** Policy → App content → Content rating  
**Category to select:** `Dating`

| Question | Answer |
|---|---|
| Does the app contain references to alcohol, tobacco, or drugs? | **No** |
| Does the app contain simulated gambling? | **No** |
| Does the app contain sexual content or nudity? | **No** — photos are user-uploaded and moderated; no nudity by design |
| Does the app allow users to interact with each other (e.g. chat)? | **Yes** |
| Does the app contain user-generated content? | **Yes** (profile photos, bios, messages) |
| Does the app share the user's location? | **No** |
| Does the app contain violence or graphic content? | **No** |
| Is this app suitable for children? | **No** — strictly 18+ |

**Expected IARC rating:** Mature 17+ (Google Play assigns automatically after submission)

---

## 4. Data Safety Section

**Location in Play Console:** Policy → App content → Data safety

### Does your app collect or share user data?
**Yes**

### Data types and purposes

| Data type | Collected | Shared with third parties | Purpose | Required? | Encrypted in transit? |
|---|---|---|---|---|---|
| Name | Yes | No (shown only to confirmed matches) | App functionality | Yes | Yes |
| Email address | Yes | Clerk (auth provider) | Account management | Yes | Yes |
| Date of birth | Yes | Stripe Identity (one-time, age verification only) | Fraud prevention / age gating | Yes | Yes |
| Photos | Yes | No | App functionality — profile display | No (optional) | Yes |
| Messages | Yes | No | App functionality — private chat | Yes | Yes |
| User IDs | Yes | No | App functionality / analytics | Yes | Yes |
| App interactions | Yes | No | Analytics | Yes | Yes |
| Crash logs | Yes | No | App functionality / stability | Yes | Yes |

### Additional answers
- **Is all collected data encrypted in transit?** Yes — HTTPS/TLS for all API traffic.
- **Can users request data deletion?** Yes — email privacy@intermingled.app; completed within 30 days.
- **Does this app follow the Families Policy?** No — strictly 18+ adults only.

---

## 5. Privacy Policy

**URL to enter in Play Console:**
```
https://<production-domain>/api/legal/privacy
```

Replace `<production-domain>` with the deployed Replit domain once the app is published (visible in Replit → Deployments). The in-app privacy screen is at `artifacts/flirtfest-mobile/app/legal/privacy.tsx` and covers all required disclosures (data collected, third-party sharing, retention, user rights, children policy).

Contact for privacy matters: **privacy@intermingled.app**

---

## 6. Play Console Upload Checklist

Work through these sections in order — each must be saved before the next can be submitted.

### A. Store listing
- [ ] App name: `Intermingled`
- [ ] Short description: (copy from §1)
- [ ] Full description: (copy from §1)
- [ ] Phone screenshots: upload all 3 files from this directory
- [ ] Feature graphic: upload `feature_graphic.png` (1024 × 500 px — ready)
- [ ] App icon: resize `artifacts/flirtfest-mobile/assets/images/icon.png` to 512 × 512 px and upload
- [ ] Privacy policy URL: `https://<production-domain>/api/legal/privacy`
- [ ] Category: **Social → Dating**

### B. App content (Policy)
- [ ] Content rating: fill questionnaire using §3 answers → submit → accept the assigned rating
- [ ] Data safety: fill using §4 table → save
- [ ] Target audience: select **18 and older**
- [ ] Ads declaration: **No ads**

### C. Pricing & distribution
- [ ] Confirm countries/regions (start with your target markets)
- [ ] Confirm the app is **Free** to download (IAP/subscription unlocks premium features later)
- [ ] Confirm it is **not** designed for children

### D. Release
- [ ] Verify the internal testing release is active and the APK/AAB installs correctly
- [ ] Once all sections above show a green checkmark, click **Promote release** → **Open testing** (or **Production**)

---

## 7. Reviewer Notes

- **Age verification flow:** Stripe Identity is used for one-time government-ID age gating. This is disclosed in both the full description and the data safety section. Google Play reviewers may test the age-gate flow on a test account — the flow opens a Stripe-hosted browser page and returns to the app after verification.
- **Subscription:** A premium subscription tier is described in the full description. Register it under Monetization → Subscriptions before going to production (follow-up task #20).
- **App icon size:** Play Console requires exactly 512 × 512 px. The icon at `artifacts/flirtfest-mobile/assets/images/icon.png` must be resized before upload.
