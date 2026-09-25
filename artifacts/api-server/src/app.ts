import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pinoHttp from "pino-http";
import helmet from "helmet";
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

// ── Dynamic Static Asset Resolution ─────────────────────────────────────────
function getActiveWebDistPath(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), "artifacts/speed-date/dist"),
    path.resolve(__dirname, "../../speed-date/dist"),
    path.resolve(__dirname, "dist"),
    path.resolve(__dirname, "dist/dist"),
    path.resolve(process.cwd(), "artifacts/api-server/dist/dist"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, "index.html"))) {
      return p;
    }
  }
  return possiblePaths[0];
}

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const activePath = getActiveWebDistPath();
  express.static(activePath, {
    maxAge: isProduction ? "1y" : 0,
    immutable: isProduction,
    index: false,
  })(req, res, next);
});

// Handle favicon.ico requests instantly to prevent 15s gateway timeouts
app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

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
const generalLimiter = (_req: any, _res: any, next: any) => next();
const authLimiter = (_req: any, _res: any, next: any) => next();

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

// ── Direct Auth Handlers ───────────────────────────────────────────────────
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendConfirmationEmail } from "./lib/emailService";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function verifyPassword(password: string, hash: string): boolean {
  const [salt, key] = hash.split(":");
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = scryptSync(password, salt, 64);
  return timingSafeEqual(keyBuffer, derivedKey);
}

app.post("/api/auth/register", async (req: any, res: any) => {
  const { email, password, name, ageVerified, termsAccepted } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Email, password, and name are required" });
  }
  if (ageVerified !== true || termsAccepted !== true) {
    return res.status(400).json({ error: "You must be 18 or older and accept the Terms of Service and Privacy Policy to register." });
  }
  try {
    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email.toLowerCase()),
    });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }
    const userId = "u_" + randomBytes(8).toString("hex");
    const verificationToken = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const hasEmailProvider = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_PASS || process.env.SMTP_PASSWORD);
    const isVerified = !hasEmailProvider;

    await db.insert(usersTable).values({
      id: userId,
      email: email.toLowerCase(),
      name,
      passwordHash: hashPassword(password),
      status: "looking",
      ageVerified: true,
      termsAccepted: true,
      privacyAccepted: true,
      consentTimestamp: new Date(),
      isVerified,
      verificationToken: isVerified ? null : verificationToken,
      verificationTokenExpiresAt: isVerified ? null : expiresAt,
    });

    if (hasEmailProvider) {
      sendConfirmationEmail(email.toLowerCase(), name, verificationToken).catch((err) => {
        logger.error({ err, recipient: email }, "Background email dispatch error");
      });
    }

    res.status(201).json({
      message: isVerified
        ? "Account created successfully!"
        : "Account created! Please check your email to confirm your account.",
      requiresConfirmation: !isVerified,
      user: { id: userId, email, name, isVerified }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

app.post("/api/auth/login", async (req: any, res: any) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email.toLowerCase()),
    });
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.json({
      token: user.id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "chooser",
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ── API Router ───────────────────────────────────────────────────────────────
app.use("/api", router);

// Serve chat attachments
const chatAssetsPath = path.resolve(__dirname, "../../attached_assets/chat");
app.use("/api/chat/assets", express.static(chatAssetsPath));

// ── Android App Links (.well-known/assetlinks.json) ─────────────────────────
app.get("/.well-known/assetlinks.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  const activePath = getActiveWebDistPath();
  res.sendFile(path.join(activePath, "assetlinks.json"));
});

// Fallback to index.html for SPA routing
app.get("*path", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const activePath = getActiveWebDistPath();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(activePath, "index.html"));
});

export default app;
