# Android Automated Release Setup

Follow these steps once to wire up automated uploads to Google Play. After setup, `eas submit` handles everything without manual downloads or uploads.

## Prerequisites

- Google Play Console access for `com.intermingled.app`
- EAS CLI installed and logged in (`eas whoami`)

---

## Step 1 — Link a Google Cloud project in Play Console

1. Open [Google Play Console](https://play.google.com/console) → **Setup → API access**
2. Click **Link to an existing Google Cloud project** (or create a new one)
3. Follow the prompts to link the project

## Step 2 — Create a service account

1. Still in **API access**, click **Create new service account**
2. Follow the link to Google Cloud Console
3. Name it something like `eas-submit-intermingled`
4. Grant it the **Service Account User** role, then finish
5. Back in Play Console → **API access**, find the new account and click **Grant access**
6. Set the role to **Release manager** (minimum needed to upload to a track)
7. Click **Apply** and **Save**

## Step 3 — Download the JSON key

1. In [Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts), click the service account you just created
2. Go to **Keys → Add Key → Create new key → JSON**
3. Save the downloaded file locally as `google-play-service-account.json` (the filename doesn't matter, but keep it out of the repo — it's already in `.gitignore`)

## Step 4 — Store the key as an EAS secret

Run this once from `artifacts/flirtfest-mobile/`:

```bash
eas secret:create \
  --scope project \
  --name GOOGLE_PLAY_SERVICE_ACCOUNT \
  --type file \
  --value ./google-play-service-account.json
```

EAS stores the file contents securely. The secret is injected as a file path at submit time — `eas.json` already references it via `$GOOGLE_PLAY_SERVICE_ACCOUNT`.

You can safely delete your local copy of the JSON key after this step.

## Step 5 — Verify

```bash
eas secret:list
```

You should see `GOOGLE_PLAY_SERVICE_ACCOUNT` listed with type `file`.

---

## Releasing a new version

Build and submit in two commands:

```bash
# From artifacts/flirtfest-mobile/
eas build --platform android --profile production
eas submit --platform android --profile production --latest
```

Or combine into one:

```bash
eas build --platform android --profile production --auto-submit
```

The build goes to the **internal testing** track on Google Play automatically.
