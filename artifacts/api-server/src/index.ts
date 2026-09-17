import { createServer } from "http";
import app from "./app";
import { initSocket } from "./socket";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "8080";

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  console.error(`Invalid PORT value: "${rawPort}"`);
  process.exit(1);
}

try {
  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on port ${port} (0.0.0.0)`);
    logger.info({ port }, "Server listening on 0.0.0.0");
  });
} catch (err) {
  console.error("FATAL STARTUP CRASH:", err);
  process.exit(1);
}
