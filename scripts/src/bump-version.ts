import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appJsonPath = resolve(scriptDir, "../../artifacts/flirtfest-mobile/app.json");

const raw = readFileSync(appJsonPath, "utf-8");
const appJson = JSON.parse(raw) as { expo: { version: string } };

const current = appJson.expo.version;
const parts = current.split(".").map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`Unexpected version format: "${current}". Expected semver (x.y.z).`);
  process.exit(1);
}

parts[2] += 1;
const next = parts.join(".");
appJson.expo.version = next;

writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");
console.log(`Bumped app.json version: ${current} → ${next}`);
