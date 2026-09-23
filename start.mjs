import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const possiblePaths = [
  path.resolve(process.cwd(), "dist/index.mjs"),
  path.resolve(process.cwd(), "artifacts/api-server/dist/index.mjs"),
  path.resolve(__dirname, "artifacts/api-server/dist/index.mjs")
];

let targetPath = possiblePaths.find(p => fs.existsSync(p));

if (!targetPath) {
  console.error("[start.mjs] FATAL: Could not locate compiled dist/index.mjs in any of:", possiblePaths);
  process.exit(1);
}

console.log("[start.mjs] Launching production bundle at:", targetPath);
import(pathToFileURL(targetPath).href).catch((err) => {
  console.error("[start.mjs] FATAL UNCAUGHT IMPORT ERROR:", err);
  process.exit(1);
});
