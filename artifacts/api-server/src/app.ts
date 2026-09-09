import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

const isProduction = process.env.NODE_ENV === "production";

// ── Security Headers (Helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Managed by SPA index.html metadata
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  })
);

// ── Structured Pino HTTP Logging ──────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

// ── Rate Limiting ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login/register attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later." },
});

app.use("/api/auth/", authLimiter);
app.use("/api/", generalLimiter);

// ── Stripe Webhook — MUST be before express.json() ───────────────────────────
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error({ err: error }, "Stripe webhook error");
      res.status(400).json({ error: error.message || "Webhook processing error" });
    }
  }
);

// ── Strict CORS Policy ────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://www.intermingledapp.com",
  "https://intermingledapp.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || !isProduction || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── API Router ───────────────────────────────────────────────────────────────
app.use("/api", router);

// Serve static files from the web project's build directory
const webDistPath = path.resolve(__dirname, "../../../artifacts/speed-date/dist");
app.use(express.static(webDistPath));

// Serve chat attachments
const chatAssetsPath = path.resolve(__dirname, "../../../attached_assets/chat");
app.use("/api/chat/assets", express.static(chatAssetsPath));

// ── Android App Links (.well-known/assetlinks.json) ─────────────────────────
app.get("/.well-known/assetlinks.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.sendFile(path.join(webDistPath, "assetlinks.json"));
});

// Fallback to index.html for SPA routing
app.get("*path", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(webDistPath, "index.html"));
});

export default app;

