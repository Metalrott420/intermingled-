const fs = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..");

for (const filename of ["package-lock.json", "yarn.lock"]) {
  const filePath = path.join(workspaceRoot, filename);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
  }
}

if (!process.env.npm_config_user_agent?.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
