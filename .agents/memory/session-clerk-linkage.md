---
name: Session/Clerk user linkage
description: How speed-dating session users and Clerk-auth users are unified in usersTable so inbox/DMs work.
---

# Session ↔ Clerk User Linkage

## The rule
`POST /api/users` (called when entering a speed-dating session) is Clerk-aware:
- If the caller is Clerk-authenticated, it **upserts on the Clerk user record** (sets role/name/vector, returns the Clerk user's ID as the session userId)
- If anonymous, it creates a fresh session user with a random ID

**Why:** There are two code paths that create rows in `usersTable`:
1. `POST /api/users` — called by home.tsx when picking a role (anonymous or signed-in)
2. `GET /api/profile/me` — called by profile.tsx for Clerk-authenticated users

Without the linkage, match records created during a speed-date session reference the *session* user ID, but the inbox query uses the *Clerk* user ID — so matches are invisible.

**How to apply:** Any route that creates/updates a usersTable row should check `getAuth(req)?.userId` first and act on the Clerk user if present. The Clerk user's `id` equals their Clerk userId string (set at creation time in `getOrCreateUser`).

## Match creation (rooms.ts /choose)
Match records are created with user IDs found by **name lookup** in usersTable. This works when users are signed-in (since session user IS the Clerk user after linkage), but silently fails for anonymous users. Failure is non-fatal — room result is still valid.

## GET /api/rooms/:roomId/match
Public endpoint (no auth) in dm.ts that returns the match for a given room. Used by the result page to show the DM CTA without requiring auth.
