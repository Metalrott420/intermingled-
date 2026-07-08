# Threat Model

## Project Overview

Intermingled / Flirtfest is a monorepo for a dating-style application with a public web client (`artifacts/speed-date`), an Expo mobile client (`artifacts/flirtfest-mobile`), and an Express API server (`artifacts/api-server`) backed by PostgreSQL via Drizzle. Users create profiles, upload photos, join matchmaking rooms, chat in real time over Socket.IO, message private matches, and manage subscriptions and age verification through Stripe and Stripe Identity. Production scans should focus on the API server and shared DB/storage code; `artifacts/mockup-sandbox` is dev-only and out of scope unless production reachability is demonstrated.

## Assets

- **User accounts and sessions** — Clerk identities, local user records, admin flags, ban flags, and any bearer/cookie-backed session state. Compromise enables impersonation, moderation abuse, or billing access.
- **Profile and dating data** — names, emails, date of birth, bios, photos, gender preferences, personality vectors, likes, blocks, reports, and match history. This is sensitive personal data with privacy and safety implications.
- **Private communications** — room chat, group messages, and direct messages between matches. Unauthorized access exposes private conversations and enables impersonation.
- **Moderation and admin capabilities** — admin dashboards, bans, reports, and room oversight. Abuse can disrupt the product or expose large sets of user records.
- **Billing and identity-verification data** — Stripe customer/subscription identifiers and age-verification session state. Abuse can affect payments, account entitlements, or sensitive verification workflows.
- **Stored media objects** — uploaded photos and other objects in private storage. Exposure leaks user images and any other private uploads.
- **Application secrets** — database connection string, Clerk keys, Stripe keys, webhook secrets, and Replit connector credentials.

## Trust Boundaries

- **Browser / mobile client to API** — all request bodies, path params, headers, and socket events are untrusted. The server must authenticate callers and authorize every state change and data read.
- **Socket client to Socket.IO server** — socket events carry user-controlled identifiers (`userId`, `participantId`, `roomId`, `matchId`). Server-side binding between the authenticated user and these identifiers is required.
- **API to PostgreSQL** — the API server can read and mutate all application data. Broken access control or unsafe query construction at the API layer can expose or corrupt the full dataset.
- **API to object storage** — presigned upload URLs and object-download routes cross into a storage backend. Object paths, ownership, and ACLs must be enforced server-side.
- **API to third parties** — Clerk, Stripe, Stripe Identity, and Replit connector/sidecar services are trusted integrations, but all callback/webhook inputs must be verified and outbound requests must not trust client-supplied origins blindly.
- **Public / authenticated / admin surfaces** — public pages exist alongside authenticated profile, billing, messaging, and admin endpoints. Authorization must be enforced on the server, not inferred from the client UI.
- **Development / production boundary** — mockup sandbox and local build scripts are not production-reachable under the current threat model and should normally be ignored unless evidence shows otherwise.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`, `artifacts/api-server/src/socket.ts`
- **Highest-risk areas**: room/matchmaking routes, direct/group messaging, profile/media storage, admin routes, Stripe/Identity routes, object storage access control
- **Auth surfaces**: Clerk middleware in `src/app.ts`; repeated `requireAuth`/`requireAdmin` helpers in route files; unauthenticated room and socket flows need extra scrutiny
- **Dev-only areas**: `artifacts/mockup-sandbox/**`, mobile/web build scripts, local seed/admin scripts unless they become remotely reachable in production

## Threat Categories

### Spoofing

Users authenticate through Clerk, while some gameplay flows still accept anonymous or client-asserted identifiers. The system must never trust a caller solely because they provide a `userId`, `participantId`, `matchId`, or `roomId`; protected routes and socket events must bind actions to the authenticated Clerk user on the server.

### Tampering

Matchmaking rooms, profiles, likes, blocks, reports, billing flows, and stored objects all accept client input that can change server state. The application must ensure only authorized principals can mutate their own records, room state transitions, and uploaded-object references; client UI constraints are not sufficient.

### Information Disclosure

The application stores highly sensitive dating and identity data, including photos, date of birth, messages, and moderation artifacts. API responses, object-download routes, and socket subscriptions must reveal only the minimum data required to the current authorized user, and private storage objects must not become readable just because their path is known.

### Denial of Service

Public endpoints and socket events can trigger database writes, room state changes, Stripe calls, or large object downloads. The service must prevent unauthenticated or low-cost requests from repeatedly disrupting live rooms, exhausting storage or network resources, or forcing expensive external calls.

### Elevation of Privilege

Admin routes, private match conversations, and room-control actions represent higher-privilege operations than normal browsing. The system must enforce server-side ownership and role checks for all administrative functions, room moderation actions, and access to private chats or media, and it must avoid any design where knowing an identifier grants broader access.
