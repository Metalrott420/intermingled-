---
name: Stripe credential source precedence
description: Why stripeClient.ts checks the Replit connectors API before STRIPE_SECRET_KEY env var, and a caveat about deleting stale Stripe secrets.
---

The Stripe secret-key lookup order was changed to check the Replit connectors API (managed Stripe integration) **before** falling back to a raw `STRIPE_SECRET_KEY` secret.

**Why:** A user had a stale/expired `rk_live_...` (restricted) key sitting in `STRIPE_SECRET_KEY`. Reconnecting the Stripe integration through `proposeIntegration` produced a fresh, healthy `sk_test_...` key in the managed connection, but the app kept authenticating with the old expired key because the original code checked the env var first. Deleting the stale secret via `deleteEnvVars` reported success but did not actually take effect (confirmed via repeated `viewEnvVars` checks and fresh shell/workflow restarts) — this appears to be a platform-level propagation issue, not user error. Reordering precedence in code was the reliable fix.

**How to apply:** When debugging "Stripe not working" / expired-key errors on a project using the Replit-managed Stripe integration, don't assume `deleteEnvVars` on a stale `STRIPE_SECRET_KEY` will actually remove it — verify with a real workflow restart + log check, not just a `viewEnvVars` read-back. If stale, prefer fixing precedence in `stripeClient.ts` (connectors API first, env var as fallback) over relying on secret deletion.
