# Capability Audit (Post-Phase 4)

Date: 2026-07-20

Scope: Game History, Player Statistics, Achievements, Analytics, Guardian, Ballroom, GO, Events.

## 1) Existing Backend Capabilities

### Services and Core Logic

- Gameplay archival write pipeline exists via gameArchivalService.
  - Evidence: artifacts/api-server/src/services/gameArchivalService.ts
- Gameplay analytics event tracking exists via analyticsService.
  - Evidence: artifacts/api-server/src/services/analyticsService.ts
- Room lifecycle orchestration exists (create/join/start/advance/eliminate/choose/close).
  - Evidence: artifacts/api-server/src/services/gameSessionService.ts
  - Evidence: artifacts/api-server/src/services/gameFlowService.ts

### APIs

- Room lifecycle APIs exist for active room list, room fetch, join, messaging, eliminate, advance round, choose winner.
  - Evidence: artifacts/api-server/src/routes/rooms.ts
- Match and DM APIs exist for match lookup/list and message read/send.
  - Evidence: artifacts/api-server/src/routes/dm.ts
- Group post-game chat APIs exist.
  - Evidence: artifacts/api-server/src/routes/social.ts

### Database Tables

- Historical and analytics data model exists:
  - game_archives
  - player_game_history
  - player_game_stats
  - gameplay_events
  - Evidence: lib/db/src/schema/gameplay.ts

## 2) Partial / Placeholder Capabilities

- Private chat lifecycle is partial:
  - Message send/read exists.
  - Lifecycle guarantees for presence, read receipts, typing indicator, reconnect state, and idempotent channel semantics are not formalized as dedicated API contracts.
  - Evidence: artifacts/api-server/src/routes/dm.ts
  - Evidence: artifacts/api-server/src/socket.ts
- Replay endpoint is still not formalized as a separate round-by-round API contract.
  - History detail includes archived questions/round durations, but no dedicated replay timeline endpoint exists yet.
  - Evidence: artifacts/api-server/src/routes/history.ts

## 3) Missing Capabilities (Checklist)

- [x] Historical game retrieval API for a player timeline (paginated history from player_game_history + game_archives).
- [x] Archived game lookup API by roomId/archiveId (details payload suitable for Game History detail page).
- [x] Player statistics API (derived from player_game_stats with stable response schema).
- [ ] Replay/recovery API contract for historical game playback (round-by-round timeline endpoint).
- [x] Room lifecycle query APIs beyond active rooms (ended/completed rooms for a user, filtered lifecycle states).
- [ ] Private chat lifecycle APIs for typing, presence, read receipts, reconnect resume metadata.
- [x] Achievements backend model and APIs (definitions, unlock tracking, claim state).
- [x] Product analytics read APIs (time-series/segment endpoints for Analytics feature).
- [x] Event system APIs for scheduled/featured events (if Events roadmap item is product-facing).

## 4) Phase 4 Outcome

Executed backend sequence:

1. Player history list endpoint.
2. Archive detail endpoint.
3. Player stats endpoint.
4. API schema updates in OpenAPI + generated clients.
5. Integration tests for authorization, ordering, pagination, and reconnect-safe reads.

Open follow-up scope:

1. Dedicated replay timeline endpoint.
2. Private chat lifecycle contract surface (typing/presence/read receipts/replay semantics).
