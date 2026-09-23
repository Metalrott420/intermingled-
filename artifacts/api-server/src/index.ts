import { createServer } from "http";
import app from "./app";
import { initSocket } from "./socket";
import { logger } from "./lib/logger";

const port = process.env.PORT ? Number(process.env.PORT) : 8080;

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
