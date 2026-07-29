# Gameplay Architecture

## Authoritative Server Model

The gameplay backend is server-authoritative.
Clients never commit lifecycle transitions directly; they request actions and consume canonical room snapshots.

- Canonical state lives in rooms and participants persistence.
- Socket events are derived from persisted state, not speculative client state.
- Reconnect flow always rehydrates from server snapshot via join_room.

Key files:

- artifacts/api-server/src/services/gameSessionService.ts
- artifacts/api-server/src/services/gameFlowService.ts
- artifacts/api-server/src/socket.ts

## Room Lifecycle

A room progresses through a strict lifecycle:

1. waiting
2. active
3. ended

Lifecycle mutations are owned by services:

- Session bootstrap and joins: gameSessionService
- Round progression, elimination, winner: gameFlowService
- Completion archival: gameArchivalService

The room payload emitted to clients is built through a single canonical response builder.

Key files:

- artifacts/api-server/src/services/gameSessionService.ts
- artifacts/api-server/src/services/gameFlowService.ts
- artifacts/api-server/src/services/gameArchivalService.ts
- artifacts/api-server/src/lib/roomUtils.ts

## Snapshot and Version Model

roomSnapshotVersion is the only ordering authority.
It increments on every authoritative room mutation.

- Version included in room_updated, round_started, timer_sync, round_advanced, suitor_eliminated, session_ended.
- Clients drop stale events when version is older than current applied snapshot.
- Server-side emit assertions prevent version regression.

Key files:

- lib/db/src/schema/rooms.ts
- artifacts/api-server/src/services/messagingService.ts
- artifacts/api-server/src/socket/events.ts
- artifacts/speed-date/src/hooks/useSocket.ts

## Reconnect Strategy

Reconnect is snapshot-first and idempotent:

- join_room verifies participant ownership.
- Existing participant socket is evicted when a newer socket joins.
- Server immediately emits canonical room_updated snapshot.

This guarantees convergence after browser refresh, temporary disconnect, long disconnect, and multi-tab races.

Key files:

- artifacts/api-server/src/socket.ts
- artifacts/api-server/src/tests/integration/reconnect/reconnect-recovery.integration.test.ts
- artifacts/api-server/src/tests/integration/recovery/state-recovery.integration.test.ts

## Ordering Guarantees

Ordering guarantees are enforced by version monotonicity:

- Emission path tracks last emitted version per room.
- Lower-version lifecycle emissions fail under strict assertions.
- Delayed timer and out-of-order lifecycle packets cannot regress state.

Key files:

- artifacts/api-server/src/services/messagingService.ts
- artifacts/api-server/src/tests/integration/ordering/snapshot-ordering.integration.test.ts

## Idempotency Rules

Two idempotency boundaries are explicit:

- Duplicate archival: second archival attempt is skipped.
- Duplicate match creation: existing chooser/suitor match short-circuits insertion.

Both paths log duplicate behavior explicitly for diagnostics.

Key files:

- artifacts/api-server/src/services/gameArchivalService.ts
- artifacts/api-server/src/services/gameFlowService.ts
- artifacts/api-server/src/services/gameplayAssertions.ts
- artifacts/api-server/src/tests/integration/idempotency/idempotency.integration.test.ts

## Gameplay Assertions

Runtime assertions protect invariants during lifecycle transitions:

- Allowed status transitions only.
- Round monotonic progression.
- Winner immutability once finalized.
- Non-decreasing emitted snapshot versions.

Assertions are strict in non-production to fail fast during development and testing.

Key files:

- artifacts/api-server/src/services/gameplayAssertions.ts
- artifacts/api-server/src/services/messagingService.ts

## Integration Test Organization

Integration proof is grouped into six permanent categories:

- reconnect: socket identity and reconvergence behavior
- recovery: offline/long reconnect and post-chat recovery
- ordering: stale/out-of-order and delayed-event rejection
- idempotency: duplicate archival and duplicate match prevention
- messaging: premium sync and room update propagation
- archival: completion archival persistence and reconnect-to-ended consistency

Test layout:

- artifacts/api-server/src/tests/integration/reconnect
- artifacts/api-server/src/tests/integration/recovery
- artifacts/api-server/src/tests/integration/ordering
- artifacts/api-server/src/tests/integration/idempotency
- artifacts/api-server/src/tests/integration/messaging
- artifacts/api-server/src/tests/integration/archival

Release gate scripts are defined in artifacts/api-server/package.json:

- test:critical
- test:integration
- test:reconnect
- test:recovery
- test:ordering
- test:idempotency
- test:messaging
- test:archival
