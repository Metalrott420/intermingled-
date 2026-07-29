# Android Cutover Checklist (No Expo)

This checklist is only the actions that require you. Everything else is now wired in code.

## 1) Run the native app locally

From repo root:

```powershell
pnpm start:native
```

In a second terminal:

```powershell
pnpm android:native
```

Expected result:
- App opens as Intermingled.
- Home screen can open `https://intermingledapp.com`.
- Backend status screen checks `https://www.intermingledapp.com/api/healthz`.

## 2) Create your Android release keystore (one-time)

Run this from `artifacts/flirtfest-mobile-native/android/app` and store values safely:

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore intermingled-release-key.keystore -alias intermingled-key -keyalg RSA -keysize 2048 -validity 10000
```

## 3) Add signing secrets to `gradle.properties`

Edit `artifacts/flirtfest-mobile-native/android/gradle.properties` and append:

```properties
INTERMINGLED_UPLOAD_STORE_FILE=intermingled-release-key.keystore
INTERMINGLED_UPLOAD_KEY_ALIAS=intermingled-key
INTERMINGLED_UPLOAD_STORE_PASSWORD=YOUR_STORE_PASSWORD
INTERMINGLED_UPLOAD_KEY_PASSWORD=YOUR_KEY_PASSWORD
```

## 4) Put the keystore in the app folder

Copy keystore to:
- `artifacts/flirtfest-mobile-native/android/app/intermingled-release-key.keystore`

## 5) Build release artifacts

From repo root:

```powershell
pnpm android:native:release
pnpm android:native:bundle
```

Expected output AAB path:
- `artifacts/flirtfest-mobile-native/android/app/build/outputs/bundle/release/app-release.aab`

## 6) Upload to Play Console internal track

- Open Play Console for package `com.intermingled.app`.
- Create/update Internal testing release.
- Upload generated AAB.
- Roll out to testers.

## 7) Domain verification for app links (required for link auto-open)

Publish this exact file from your domain:
- `https://intermingledapp.com/.well-known/assetlinks.json`
- `https://www.intermingledapp.com/.well-known/assetlinks.json`

File content format:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.intermingled.app",
      "sha256_cert_fingerprints": [
        "YOUR_PLAY_SIGNING_CERT_SHA256"
      ]
    }
  }
]
```

Get `YOUR_PLAY_SIGNING_CERT_SHA256` from Play Console App Integrity page.

## 8) Optional but recommended next migration tasks

- Replace Expo auth package with native Clerk package.
- Move full screen set from Expo Router to React Navigation.
- Replace Expo notifications with FCM/native notifications.
