import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const speedDateDist = path.resolve(artifactDir, "../speed-date/dist");
  const distDir = path.resolve(artifactDir, "dist");

  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: [
      "*.node",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "sharp",
      "fsevents",
      "bcrypt",
      "argon2",
    ],
    sourcemap: "linked",
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });

  const targetDist = path.resolve(distDir, "dist");
  if (existsSync(speedDateDist)) {
    await mkdir(targetDist, { recursive: true });
    const entries = await readdir(speedDateDist);
    for (const entry of entries) {
      await cp(path.join(speedDateDist, entry), path.join(targetDist, entry), { recursive: true });
    }
    console.log("[build.mjs] Successfully copied speed-date/dist contents into api-server/dist/dist");
  } else {
    console.warn(`[build.mjs] Warning: ${speedDateDist} does not exist, skipping static dist copy.`);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
