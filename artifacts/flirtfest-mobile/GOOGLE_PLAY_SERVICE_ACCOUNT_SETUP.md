# Google Play Service Account Setup Guide

This guide walks you through creating a Google Play service account JSON key file and storing it as an EAS secret. This is required for `eas submit` to automatically upload your AAB to Google Play.

## Prerequisites

- Google Play Console access for `com.intermingled.app`
- Google account with Release manager or Administrator role
- EAS CLI installed and authenticated (`eas whoami` should show `metalrott`)

---

## Step 1 — Link a Google Cloud project in Play Console

1. Open [Google Play Console](https://play.google.com/console)
2. Select the **Intermingled** app (`com.intermingled.app`)
3. Go to **Setup → API access**
4. Click **Link to an existing Google Cloud project** (or create a new one)
5. Follow the prompts to link the project

## Step 2 — Create a service account

1. Still in **Setup → API access**, click **Create new service account**
2. Follow the link to [Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
3. Click **+ Create Service Account**
4. Name it: `eas-submit-intermingled`
5. Grant it the **Service Account User** role
6. Click **Done**

## Step 3 — Grant Play Console access to the service account

1. Back in Play Console → **API access**, find the new service account
2. Click **Grant access**
3. Set the role to **Release manager** (minimum needed to upload to a track)
4. Click **Apply** and **Save**

## Step 4 — Download the JSON key

1. In [Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts), click the service account you just created
2. Go to **Keys → Add Key → Create new key → JSON**
3. Save the downloaded file as `google-play-service-account.json` in the `artifacts/flirtfest-mobile/` directory

## Step 5 — Store the key as an EAS secret

From `artifacts/flirtfest-mobile/`, run:

```bash
eas secret:create \
  --scope project \
  --name GOOGLE_PLAY_SERVICE_ACCOUNT \
  --type file \
  --value ./google-play-service-account.json
```

EAS stores the file contents securely. The secret is injected as a file path at submit time — `eas.json` already references it via `$GOOGLE_PLAY_SERVICE_ACCOUNT`.

You can safely delete your local copy of the JSON key after this step.

## Step 6 — Verify

```bash
eas secret:list
```

You should see `GOOGLE_PLAY_SERVICE_ACCOUNT` listed with type `file`.

---

## After Setup — Build and Submit

Once the service account is configured:

```bash
# From artifacts/flirtfest-mobile/ — queue the build
eas build --platform android --profile production

# Once the build finishes, submit to Google Play internal testing track
eas submit --platform android --profile production --latest
```

Or combine both:
```bash
eas build --platform android --profile production --auto-submit
```

## Troubleshooting

| Error | Fix |
|---|---|
| `serviceAccountKeyPath is not set` | Ensure `eas.json` has `"serviceAccountKeyPath": "$GOOGLE_PLAY_SERVICE_ACCOUNT"` in the submit profile |
| `No secret found for name GOOGLE_PLAY_SERVICE_ACCOUNT` | Run the `eas secret:create` command in Step 5 |
| `The Google Play Developer account is not linked to a Google Cloud project` | Complete Step 1 to link the project |
| `Insufficient permissions` | Ensure the service account has the **Release manager** role in Play Console |
| `Invalid service account` | Re-download the JSON key and re-run the `eas secret:create` command |
