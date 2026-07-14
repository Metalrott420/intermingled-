import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appJsonPath = resolve(scriptDir, "../../artifacts/flirtfest-mobile/app.json");
const repoRoot = resolve(scriptDir, "../..");

const noPush = process.argv.includes("--no-push");

if (!existsSync(appJsonPath)) {
  console.error(
    `Error: app.json not found at ${appJsonPath}\n` +
      `Fix: make sure the file exists at that path before running the version bump.`
  );
  process.exit(1);
}

let raw: string;
try {
  raw = readFileSync(appJsonPath, "utf-8");
} catch (err) {
  console.error(
    `Error: Could not read app.json at ${appJsonPath}\n` +
      `Cause: ${err instanceof Error ? err.message : String(err)}`
  );
  process.exit(1);
}

let appJson: unknown;
try {
  appJson = JSON.parse(raw);
} catch (err) {
  console.error(
    `Error: app.json at ${appJsonPath} contains invalid JSON.\n` +
      `Cause: ${err instanceof Error ? err.message : String(err)}\n` +
      `Fix: open the file in an editor, correct the syntax, and re-run the script.`
  );
  process.exit(1);
}

if (
  typeof appJson !== "object" ||
  appJson === null ||
  !("expo" in appJson) ||
  typeof (appJson as Record<string, unknown>).expo !== "object" ||
  (appJson as Record<string, unknown>).expo === null ||
  typeof ((appJson as Record<string, unknown>).expo as Record<string, unknown>)
    .version !== "string"
) {
  console.error(
    `Error: app.json does not have the expected structure (requires expo.version string).\n` +
      `Fix: ensure app.json has the shape { "expo": { "version": "x.y.z", ... } }.`
  );
  process.exit(1);
}

const typed = appJson as { expo: { version: string } };
const current = typed.expo.version;

const semverRe = /^\d+\.\d+\.\d+$/;
if (!semverRe.test(current)) {
  console.error(
    `Error: Current version "${current}" is not a plain semver (x.y.z).\n` +
      `This may be a pre-release or manually set value. The script will not overwrite it automatically.\n` +
      `Fix: set expo.version in app.json to a plain x.y.z value (e.g. "1.0.0") and re-run.`
  );
  process.exit(1);
}

const parts = current.split(".").map(Number);
parts[2] += 1;
const next = parts.join(".");
typed.expo.version = next;

writeFileSync(appJsonPath, JSON.stringify(typed, null, 2) + "\n");
console.log(`Bumped app.json version: ${current} → ${next}`);

const tag = `v${next}`;

function run(cmd: string, description: string): void {
  try {
    execSync(cmd, { cwd: repoRoot, stdio: "pipe" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${description} failed.\nCommand: ${cmd}\nCause: ${msg}`);
    process.exit(1);
  }
}

const relativeAppJson = "artifacts/flirtfest-mobile/app.json";
run(`git add ${relativeAppJson}`, "stage app.json");
run(`git commit -m "chore: bump version to ${tag}"`, "create version commit");
console.log(`Created commit: chore: bump version to ${tag}`);

run(`git tag ${tag}`, "create version tag");
console.log(`Created tag: ${tag}`);

if (noPush) {
  console.log("Skipping push (--no-push flag set). Run the following to publish:");
  console.log(`  git push && git push origin ${tag}`);
} else {
  run("git push", "push commit to remote");
  run(`git push origin ${tag}`, "push tag to remote");
  console.log(`Pushed commit and tag ${tag} to remote.`);
}
