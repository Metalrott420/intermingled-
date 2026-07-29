# Internal Testing Smoke Checklist

Date: __________
Tester: __________
Device: __________
Android Version: __________
Build: 1.0.2 (versionCode 5)
AAB: release/intermingled-1.0.2-5.aab

## 1) Pre-flight

- [ ] EAS production environment variables are fully populated
- [ ] Play Console internal testing track has latest AAB uploaded
- [ ] Tester account is added to internal testing list
- [ ] API backend is reachable from mobile network
- [ ] Push notification provider is configured and reachable
- [ ] RevenueCat products are active for Android

## 2) Authentication

- [ ] New account creation succeeds
- [ ] Existing account login succeeds
- [ ] Logout succeeds
- [ ] App restart preserves signed-in state when expected
- [ ] App restart preserves signed-out state when expected

Notes:


## 3) Core Match Flow

- [ ] Role selection works
- [ ] Matchmaking/pool entry works
- [ ] Live game room opens
- [ ] Round progression works
- [ ] Elimination flow works
- [ ] Winner selection/result screen works

Notes:


## 4) Messaging

- [ ] Inbox loads
- [ ] Conversation opens
- [ ] Send message works
- [ ] Receive message works
- [ ] Reconnect behavior is stable after temporary network loss

Notes:


## 5) Profile

- [ ] Profile loads
- [ ] Edit profile fields and save successfully
- [ ] Upload/select profile photo works

Notes:


## 6) Push Notifications

- [ ] Push permission prompt appears (if first run)
- [ ] Push token registration succeeds
- [ ] Notification received while app is foregrounded
- [ ] Notification received while app is backgrounded
- [ ] Tapping notification routes to expected screen

Notes:


## 7) Premium Purchases

- [ ] Offerings load
- [ ] Purchase flow succeeds with test account
- [ ] Restore purchases works
- [ ] Premium entitlement sync reflects in app UI/features

Notes:


## 8) History and Replay

- [ ] History list loads
- [ ] History detail opens
- [ ] Replay timeline renders expected rounds/events

Notes:


## 9) Release Decision

- [ ] PASS: Promote internal build to wider testing
- [ ] FAIL: Block promotion and file issues

Blocking issues:


Non-blocking issues:


