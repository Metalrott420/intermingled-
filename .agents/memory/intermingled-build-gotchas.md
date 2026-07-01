---
name: Intermingled Build Gotchas
description: Sharp edges specific to the Intermingled monorepo that are non-obvious and cause silent failures.
---

## Gotchas

**nanoid not available in api-server**
`nanoid` is not installed in `artifacts/api-server`. Use `import { randomBytes } from "crypto"` and `randomBytes(8).toString("hex")` everywhere IDs are generated server-side.

**Why:** The package was never added to api-server's dependencies. Adding it would work but `randomBytes` is zero-dependency.

**Google Fonts @import must go in HTML, not CSS**
PostCSS (Tailwind v4 pipeline) inlines `@import "tailwindcss"` early, so any `@import url(...)` after it triggers "must precede all other statements". Load fonts via `<link>` in `index.html` instead.

**Why:** Tailwind v4's PostCSS plugin expands before the browser sees CSS order rules.

**Rebuild libs before leaf typechecks after schema changes**
After changing anything in `lib/db/src/schema/`, run `pnpm run typecheck:libs` before running `pnpm --filter @workspace/api-server run typecheck`. Without it, the api-server sees stale declarations and reports missing exports even though the source is correct.

**Why:** Composite libs emit `.d.ts` to `dist/`; leaf artifacts import from `dist/`, not `src/`.
