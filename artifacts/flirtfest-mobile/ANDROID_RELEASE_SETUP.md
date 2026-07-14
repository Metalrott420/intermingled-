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

## Step 6 — Set up GitHub Actions for automated submission with alerts

The workflow at `.github/workflows/android-submit.yml` runs `eas submit` and sends a Slack message whether it succeeds or fails — so a failed release is never silently lost.

### 6a — Add GitHub secrets

In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret name | Value |
|---|---|
| `EXPO_TOKEN` | An EAS access token (`eas whoami --token` or create one at [expo.dev/accounts/\[account\]/settings/access-tokens](https://expo.dev/)) |
| `SLACK_WEBHOOK_URL` | An [incoming webhook URL](https://api.slack.com/messaging/webhooks) for the channel where you want alerts |

### 6b — Create a Slack incoming webhook

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**
2. Name it `Intermingled Releases` and pick your workspace
3. Under **Features**, click **Incoming Webhooks → Activate Incoming Webhooks**
4. Click **Add New Webhook to Workspace**, pick the `#releases` channel (or any channel you prefer)
5. Copy the webhook URL — paste it as the `SLACK_WEBHOOK_URL` GitHub secret above

### 6c — Trigger the workflow

The workflow is triggered manually (**workflow_dispatch**) — it doesn't run on every push. To submit a build:

1. In GitHub → **Actions → Android Submit**
2. Click **Run workflow** → pick the profile (`production`) → **Run workflow**

On completion you will receive a Slack message in your chosen channel:

- **Green** ✅ — version, track, and a link to the run
- **Red** ❌ — failure alert with a direct link to the run logs so you can diagnose the problem immediately

---

## Releasing a new version

Build first, then submit via GitHub Actions:

```bash
# From artifacts/flirtfest-mobile/ — queue the build
eas build --platform android --profile production
```

Once the build finishes, trigger the **Android Submit** workflow in GitHub Actions (see Step 6c above). The workflow calls `eas submit --latest` and posts the result to Slack.

Or, for a fully local release (skipping the GitHub Actions alert):

```bash
eas build --platform android --profile production
eas submit --platform android --profile production --latest
```

Or combine both into one command (note: no Slack alert in this path):

```bash
eas build --platform android --profile production --auto-submit
```

The build goes to the **internal testing** track on Google Play automatically.
