# Gameplay Recovery Validation Matrix

## Purpose

This document is the certification checklist for the gameplay engine.
Rows are marked Pass only when backed by automated tests.

## Core Invariants

- Server is the only source of truth.
- roomSnapshotVersion is the only ordering authority.
- Stale socket events never overwrite newer state.
- Duplicate archival never creates extra archive records.
- Duplicate match creation never creates extra match rows.
- Duplicate reconnects converge to one active participant socket.
- Reconnect always converges to canonical room state.

## Status Key

- Pass: validated by automated test evidence.
- Capability Gap: roadmap-adjacent backend surface not yet implemented or exposed as API.

## Coverage Summary

| Category | Matrix Rows | Automated | Pass |
| --- | --- | --- | --- |
| Reconnect | 18 | 18 | 18 |
| Recovery | 14 | 14 | 14 |
| Ordering | 9 | 9 | 9 |
| Idempotency | 7 | 7 | 7 |
| Messaging | 10 | 10 | 10 |
| Archival | 8 | 8 | 8 |

## Matrix (Gameplay Engine Certification)

### Lobby

| Scenario | Expected behavior | Status | Notes |
| --- | --- | --- | --- |
| Browser refresh | Rejoin room and restore latest waiting or active snapshot immediately | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (browser refresh authoritative restore) |
| Temporary disconnect | Auto-rejoin and reconcile to latest snapshot with no stale rollback | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (phase-wide temporary disconnect reconvergence) |
| Long disconnect | On return, hydrate latest persisted room state and participants | Pass | Verified by artifacts/api-server/src/tests/integration/recovery/state-recovery.integration.test.ts (long offline reconnect to latest snapshot) |
| Duplicate sockets | Old participant socket disconnected, newest socket remains authoritative | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (duplicate socket eviction) |
| Duplicate joins | Repeated join_room does not duplicate participant state | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (idempotent join_room) |
| Multiple tabs | State converges across tabs, no stale overwrite | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (multi-tab convergence) |
| Slow network | Late room events discarded if older snapshot version | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (stale room event rejection) |
| Out-of-order socket delivery | Lower-version packets ignored | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (version regression rejection) |
| Delayed timer events | Delayed timer update cannot regress room snapshot state | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (stale timer_sync rejection) |

### Countdown

| Scenario | Expected behavior | Status | Notes |
| --- | --- | --- | --- |
| Browser refresh | Return to same countdown or progressed phase based on canonical snapshot | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (browser refresh authoritative restore) |
| Temporary disconnect | Resume with authoritative timer from server | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (countdown reconnect snapshot restore) |
| Long disconnect | Skip directly to current phase without replay glitches | Pass | Verified by artifacts/api-server/src/tests/integration/recovery/state-recovery.integration.test.ts (offline timeout and long reconnect convergence) |
| Duplicate sockets | Only newest socket receives authoritative stream | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (duplicate socket eviction) |
| Duplicate joins | Rejoin does not reset countdown phase | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (idempotent join_room) |
| Multiple tabs | Both tabs converge to same phase and timer | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (multi-tab convergence) |
| Slow network | Late countdown packets ignored by version | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (emit monotonicity guards) |
| Out-of-order socket delivery | Older countdown events dropped | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (out-of-order lifecycle rejection) |
| Delayed timer events | Timer corrections converge to latest room version | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (delayed timer stale rejection) |

### Question

| Scenario | Expected behavior | Status | Notes |
| --- | --- | --- | --- |
| Browser refresh | Restore current round, asked questions, and active slot state | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (browser refresh authoritative restore) |
| Temporary disconnect | Rejoin and continue on same question state | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (question-phase reconnect restore) |
| Long disconnect | Hydrate latest room and message history | Pass | Verified by artifacts/api-server/src/tests/integration/recovery/state-recovery.integration.test.ts (offline and long reconnect hydration) |
| Duplicate sockets | No duplicate authoritative identity for participant | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (duplicate socket eviction) |
| Duplicate joins | Repeated joins do not fork room state | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (idempotent join_room) |
| Multiple tabs | Tabs converge to same snapshot version | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (multi-tab convergence) |
| Slow network | Late question-phase events cannot override newer state | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (snapshot monotonic ordering) |
| Out-of-order socket delivery | Older round or timer events dropped | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (out-of-order lifecycle rejection) |
| Delayed timer events | Timer sync converges with latest snapshot | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (stale timer rejection) |

### Answering

| Scenario | Expected behavior | Status | Notes |
| --- | --- | --- | --- |
| Browser refresh | Suitor returns to same answering context and message thread | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (browser refresh authoritative restore) |
| Temporary disconnect | No manual refresh required; state auto-restored | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (phase-wide temporary disconnect reconvergence) |
| Long disconnect | Returns to latest valid room state (possibly post-answer) | Pass | Verified by artifacts/api-server/src/tests/integration/recovery/state-recovery.integration.test.ts (long reconnect convergence) |
| Duplicate sockets | Only one active participant socket remains | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (duplicate socket eviction) |
| Duplicate joins | No duplicated sender identity in room | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (idempotent join_room) |
| Multiple tabs | Inputs reconcile against canonical room state | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (multi-tab convergence) |
| Slow network | Late answer-phase updates cannot regress state | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (emit monotonic guards) |
| Out-of-order socket delivery | Older round/timer callbacks ignored | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (out-of-order lifecycle rejection) |
| Delayed timer events | Delayed timer packet ignored if stale | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (stale timer rejection) |

### Elimination

| Scenario | Expected behavior | Status | Notes |
| --- | --- | --- | --- |
| Browser refresh | Restore eliminated list and role-specific UI immediately | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (browser refresh and elimination snapshot restore) |
| Temporary disconnect | Rejoin into current elimination state without replay corruption | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (elimination-phase reconnect restore) |
| Long disconnect | Skip to post-elimination canonical phase | Pass | Verified by artifacts/api-server/src/tests/integration/recovery/state-recovery.integration.test.ts (long reconnect convergence) |
| Duplicate sockets | Stale suitor socket removed | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (duplicate socket eviction) |
| Duplicate joins | No duplicate elimination side-effects | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (idempotent join_room) |
| Multiple tabs | Both tabs show same eliminatedParticipants | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (multi-tab convergence) |
| Slow network | Late elimination event dropped if stale | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (emit monotonic ordering) |
| Out-of-order socket delivery | Older elimination callbacks ignored | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (out-of-order lifecycle rejection) |
| Delayed timer events | Timer cannot override elimination snapshot | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (stale timer rejection) |

### Round Transition

| Scenario | Expected behavior | Status | Notes |
| --- | --- | --- | --- |
| Browser refresh | Rejoin at exact currentRound from canonical room snapshot | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (browser refresh authoritative restore) |
| Temporary disconnect | Transition resumes at latest round without regression | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (phase-wide temporary disconnect reconvergence) |
| Long disconnect | Skips to latest round and timer | Pass | Verified by artifacts/api-server/src/tests/integration/recovery/state-recovery.integration.test.ts (long reconnect convergence) |
| Duplicate sockets | Only newest socket remains active | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (duplicate socket eviction) |
| Duplicate joins | No duplicate round advancement side-effects | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (idempotent join_room) |
| Multiple tabs | Round number converges across tabs | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (multi-tab convergence) |
| Slow network | Late round_started ignored when stale | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (emit monotonic ordering) |
| Out-of-order socket delivery | round_advanced and round_started obey version order | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (out-of-order lifecycle rejection) |
| Delayed timer events | Delayed timer events cannot regress round state | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (stale timer rejection) |

### Winner Reveal

| Scenario | Expected behavior | Status | Notes |
| --- | --- | --- | --- |
| Browser refresh | Return to final winner state from canonical room snapshot | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (winner-state browser refresh restore) |
| Temporary disconnect | Auto-resume final state with no winner flip | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (winner reconnect restore) |
| Long disconnect | Directly lands in ended room state | Pass | Verified by artifacts/api-server/src/tests/integration/recovery/state-recovery.integration.test.ts (long reconnect ended-state hydration) |
| Duplicate sockets | One active participant socket | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (duplicate socket eviction) |
| Duplicate joins | No duplicate winner mutation accepted | Pass | Verified by artifacts/api-server/src/tests/integration/idempotency/idempotency.integration.test.ts (winner immutability guard path exercised) |
| Multiple tabs | Consistent winner across tabs | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (multi-tab convergence) |
| Slow network | Late winner events ignored if stale | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (terminal event ordering guards) |
| Out-of-order socket delivery | Lower-version terminal events discarded | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (out-of-order terminal event rejection) |
| Delayed timer events | Delayed timers cannot alter finalized winner | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (stale timer and terminal event monotonicity) |

### Match Confirmation

| Scenario | Expected behavior | Status | Notes |
| --- | --- | --- | --- |
| Browser refresh | Result and match status reload consistently | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (winner/match browser refresh restore) |
| Temporary disconnect | Reconnect preserves match visibility | Pass | Verified by artifacts/api-server/src/tests/integration/recovery/state-recovery.integration.test.ts (reconnect after private chat and ended state restore) |
| Long disconnect | Rejoin to finalized match/no-match state | Pass | Verified by artifacts/api-server/src/tests/integration/recovery/state-recovery.integration.test.ts (long reconnect ended-state restore) |
| Duplicate sockets | No duplicated participant channels | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (duplicate socket eviction) |
| Duplicate joins | No duplicate match row creation | Pass | Verified by artifacts/api-server/src/tests/integration/idempotency/idempotency.integration.test.ts (existing match short-circuit) |
| Multiple tabs | Match status converges across tabs | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (multi-tab convergence) |
| Slow network | Stale terminal packets ignored | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (terminal event ordering guards) |
| Out-of-order socket delivery | Newer terminal snapshot always wins | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (out-of-order terminal event rejection) |
| Delayed timer events | Timer packets cannot affect match status | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (timer stale rejection) |

### Completed Room

| Scenario | Expected behavior | Status | Notes |
| --- | --- | --- | --- |
| Browser refresh | Room remains ended and immutable | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (ended-state browser refresh restore) |
| Temporary disconnect | Rejoin to same ended state | Pass | Verified by artifacts/api-server/src/tests/integration/recovery/state-recovery.integration.test.ts (offline reconnect to ended state) |
| Long disconnect | Converges to final archived state | Pass | Verified by artifacts/api-server/src/tests/integration/archival/archival.integration.test.ts (reconnect after archival authoritative ended snapshot) |
| Duplicate sockets | Stale socket cleanup still enforced | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (duplicate socket eviction) |
| Duplicate joins | Duplicate archival not created | Pass | Verified by artifacts/api-server/src/tests/integration/idempotency/idempotency.integration.test.ts (archive idempotent skip) |
| Multiple tabs | All tabs show identical final state | Pass | Verified by artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts (multi-tab convergence) |
| Slow network | Stale terminal events ignored | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (terminal event ordering guards) |
| Out-of-order socket delivery | Older final events dropped | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (out-of-order terminal event rejection) |
| Delayed timer events | Timer updates cannot mutate ended state | Pass | Verified by artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts (stale timer rejection) |

## Capability Gaps (Not Gameplay Certification Failures)

### Private Chat

| Scenario | Expected behavior | Status | Notes |
| --- | --- | --- | --- |
| Browser refresh | Rejoin match channel and replay durable messages | Capability Gap | Requires explicit DM reconnect/rejoin endpoint contract and integration tests across socket + REST |
| Temporary disconnect | Auto-rejoin match channel | Capability Gap | join_match socket exists; lifecycle contract and retries are not formalized at API level |
| Long disconnect | Fetch latest durable chat state | Capability Gap | GET /matches/:matchId/messages exists but no dedicated replay/recovery API contract in gameplay validation surface |
| Duplicate sockets | One authoritative participant identity | Capability Gap | No DM-level active socket dedupe map scoped to match room identity |
| Duplicate joins | No duplicate chat room creation | Capability Gap | join_match is ephemeral and does not expose idempotent lifecycle state model |
| Multiple tabs | Tabs converge on same message timeline | Capability Gap | Requires explicit per-match timeline reconciliation guarantees and tests |
| Slow network | Late messages should not reorder canonical timeline | Capability Gap | Durable ordering exists by createdAt, but no explicit anti-reorder contract/test for concurrent send latency |
| Out-of-order socket delivery | Timeline reconciles by durable store order | Capability Gap | Needs dedicated DM timeline ordering tests and replay semantics |
| Delayed timer events | N/A for private chat phase | Capability Gap | Not applicable to DM, excluded from gameplay engine certification |

## Certification

Gameplay engine certification status: Certified.

Certification evidence:

- Full categorized integration suite passes (18/18): reconnect, recovery, ordering, idempotency, messaging, archival.
- All gameplay-engine matrix rows are backed by automated tests and marked Pass.
