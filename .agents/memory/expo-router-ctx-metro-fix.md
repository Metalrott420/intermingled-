---
name: Expo Router _ctx Metro bundling fix
description: How to fix "First argument of require.context should be a string" when bundling flirtfest-mobile
---

## The Problem

Metro's `require.context()` handler (in `@expo/metro-config/build/transform-worker/collect-dependencies.js`) uses Babel's `path.evaluate()` to statically analyze the first argument. It throws `InvalidRequireCallError` if the argument isn't a static string.

`expo-router/_ctx.ios.js` contains:
```js
export const ctx = require.context(
  process.env.EXPO_ROUTER_APP_ROOT,
  ...
```

Babel's `evaluate()` does PURE static analysis — it cannot resolve `process.env.*` references at transform time. Even if `EXPO_ROUTER_APP_ROOT` is set in the process environment, `evaluate()` returns `{ confident: false }` and Metro throws.

**Why:** The deployment build hits this because the `_ctx.ios.js` file in `node_modules` is processed as-is. Expo's dev server (`expo start`) adds custom resolvers that intercept this module and serve it with the path inlined — but Expo's resolver wrapping (`withMetroResolvers`) appends those after our config, and their own interception works differently.

## The Fix

1. Create custom `_ctx.*.js` files at `artifacts/flirtfest-mobile/` (project root) with the literal `'./app'` path hardcoded for each platform variant.

2. In `metro.config.js`, add a `resolveRequest` hook that intercepts `expo-router/_ctx` and `expo-router/_ctx-html` module requests and returns the custom files instead:

```js
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "expo-router/_ctx" || moduleName === "expo-router/_ctx.js") {
    const plat = platform ?? "ios";
    return { type: "sourceFile", filePath: path.join(projectRoot, `_ctx.${plat}.js`) };
  }
  if (moduleName === "expo-router/_ctx-html" || moduleName === "expo-router/_ctx-html.js") {
    return { type: "sourceFile", filePath: path.join(projectRoot, "_ctx-html.js") };
  }
  // fall through
};
```

**Note:** The module name in `resolveRequest` is the raw import string (`"expo-router/_ctx"` without platform suffix). The `platform` argument tells you which platform is being bundled.

## Also fixed in build.js

Added `url.searchParams.set("transform.routerRoot", "app")` to the bundle URL in `downloadBundle()`. Without this, the babel-transformer logs a warning and falls back to `'app'` anyway — but adding it explicitly is more correct and silences the warning.

**Why:** Expo's babel-transformer reads `customTransformOptions.routerRoot` from the Metro bundle URL query string. This controls the Expo Router app directory for the transform.

## Files involved

- `artifacts/flirtfest-mobile/metro.config.js` — resolveRequest hook
- `artifacts/flirtfest-mobile/_ctx.ios.js` — iOS custom ctx with literal `'./app'`
- `artifacts/flirtfest-mobile/_ctx.android.js` — Android custom ctx
- `artifacts/flirtfest-mobile/_ctx.web.js` — web custom ctx
- `artifacts/flirtfest-mobile/_ctx-html.js` — +html ctx
- `artifacts/flirtfest-mobile/scripts/build.js` — added `transform.routerRoot=app` to bundle URL

## Verification

```bash
cd artifacts/flirtfest-mobile
EXPO_PUBLIC_DOMAIN=localhost EXPO_PUBLIC_REPL_ID=test timeout 180 npx expo export --platform ios
EXPO_PUBLIC_DOMAIN=localhost EXPO_PUBLIC_REPL_ID=test timeout 180 npx expo export --platform android
```

Both should complete with `› ios bundles (1):` and `› android bundles (1):` respectively.
