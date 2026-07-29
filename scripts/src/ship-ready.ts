import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Step = {
  args: string[];
  env?: Record<string, string>;
};

const steps: Step[] = [
  { args: ["run", "codegen"] },
  { args: ["run", "typecheck"] },
  { args: ["--filter", "@workspace/api-server", "run", "test:critical"] },
  { args: ["--filter", "@workspace/api-server", "run", "test:integration"] },
  { args: ["--filter", "@workspace/api-server", "run", "build"] },
  {
    args: ["--filter", "@workspace/speed-date", "run", "build"],
    env: {
      PORT: process.env.PORT ?? "4173",
      BASE_PATH: process.env.BASE_PATH ?? "/",
    },
  },
];

function runStep(step: Step) {
  const cmd = `pnpm ${step.args.join(" ")}`;
  console.log(`\n[ship] ${cmd}`);

  const result = spawnSync("pnpm", step.args, {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ...(step.env ?? {}),
    },
  });

  if (result.status !== 0) {
    throw new Error(`Ship gate failed: ${cmd}`);
  }
}

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const startedAt = Date.now();
console.log("[ship] Running ship readiness gate...");

for (const step of steps) {
  runStep(step);
}

const elapsedMs = Date.now() - startedAt;
console.log(`[ship] Gate passed in ${(elapsedMs / 1000).toFixed(1)}s`);
