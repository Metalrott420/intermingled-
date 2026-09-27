import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Prevent infinite reload loop if offline or persistent network error
function autoReloadOnDeploymentError(errorMsg?: string) {
  const LAST_RELOAD_KEY = "intermingled_last_reload";
  const now = Date.now();
  const lastReload = Number(sessionStorage.getItem(LAST_RELOAD_KEY) || 0);

  // Allow reload at most once every 10 seconds
  if (now - lastReload > 10000) {
    sessionStorage.setItem(LAST_RELOAD_KEY, String(now));
    console.warn("Asset load error detected (deployment update). Reloading page...", errorMsg);
    window.location.reload();
  } else {
    console.error("Asset load error persists after reload:", errorMsg);
  }
}

// 1. Listen for Vite chunk preload errors (fired when dynamic import chunk is missing post-deploy)
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  autoReloadOnDeploymentError("Vite preload error");
});

// 2. Listen for global resource load errors (e.g. <script> or <link> returning 404 / HTML MIME type)
window.addEventListener(
  "error",
  (event) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "SCRIPT" || target.tagName === "LINK")) {
      autoReloadOnDeploymentError(`Failed to load ${target.tagName.toLowerCase()} resource`);
    }
  },
  true
);

// 3. Listen for unhandled promise rejections caused by failed module imports
window.addEventListener("unhandledrejection", (event) => {
  const reason = String(event.reason?.message || event.reason || "");
  if (
    reason.includes("Failed to fetch dynamically imported module") ||
    reason.includes("Expected a JavaScript-or-Wasm module script") ||
    reason.includes("Importing a module script failed") ||
    reason.includes("MIME type")
  ) {
    event.preventDefault();
    autoReloadOnDeploymentError(reason);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
