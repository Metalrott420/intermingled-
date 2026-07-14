# Store Screenshot Capture Guide

The three PNG files in this directory are the Google Play Store listing screenshots.

## Current status

| File | Dimensions | Status |
|------|-----------|--------|
| `screenshot_1_quiz.png` | 1080×1920 | ✓ Meets minimum — real app render |
| `screenshot_2_pool.png` | 1080×1920 | ✓ Meets minimum — real app render |
| `screenshot_3_inbox.png` | 1080×1920 | ✓ Meets minimum — real app render |

Minimum required: **1080×1920 px** ✓

## What each screenshot shows

| File | Screen | What is visible |
|------|--------|-----------------|
| `screenshot_1_quiz.png` | Quiz / Personality | The personality quiz with a question and selectable options |
| `screenshot_2_pool.png` | Pool / Waiting room | The backstage "BACKSTAGE" screen with live suitor count, tips, and a profile card |
| `screenshot_3_inbox.png` | Inbox / Matches | The "MATCHES & MESSAGES" inbox with matched conversations |

Screenshots were rendered from the real app components using the mockup sandbox at
`/__mockup/preview/QuizScreen`, `/__mockup/preview/PoolScreen`, and
`/__mockup/preview/InboxScreen`. See `artifacts/mockup-sandbox/src/components/mockups/`
for the source components.

## Updating screenshots in the future

If the app UI changes significantly, re-render and re-capture the mockup components:

```bash
# 1. Update the component in artifacts/mockup-sandbox/src/components/mockups/
# 2. Capture via the preview server (must be running):
#    http://localhost:80/__mockup/preview/QuizScreen  (1080×1920)

# OR — for real device captures using adb:
bash scripts/capture-store-screenshots.sh all
```

## Uploading to Play Console

After updating the files, upload them in:
**Play Console → Store listing → Phone screenshots** → replace all 3 → Save
