import { Router } from "express";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendConfirmationEmail } from "../lib/emailService";

const router = Router();

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

router.post("/auth/register", async (req: any, res: any) => {
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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h expiration

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
      isVerified: false,
      verificationToken,
      verificationTokenExpiresAt: expiresAt,
    });

    // Send confirmation email asynchronously (with 8s internal timeout)
    await sendConfirmationEmail(email.toLowerCase(), name, verificationToken);

    res.status(201).json({
      message: "Account created! Please check your email to confirm your account.",
      requiresConfirmation: true,
      user: { id: userId, email, name }
    });
  } catch (err) {
    logger.error({ err }, "Register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/verify-email", async (req: any, res: any) => {
  const { token } = req.query;
  if (typeof token !== "string" || !token) {
    return res.status(400).send("<h1>Invalid verification token.</h1>");
  }

  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.verificationToken, token),
    });

    if (!user) {
      return res.status(400).send("<h1>Invalid or expired verification token.</h1>");
    }

    if (user.verificationTokenExpiresAt && new Date(user.verificationTokenExpiresAt).getTime() < Date.now()) {
      return res.status(400).send("<h1>Verification token has expired. Please register again.</h1>");
    }

    await db
      .update(usersTable)
      .set({
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      })
      .where(eq(usersTable.id, user.id));

    res.send(`
      <div style="font-family: sans-serif; background-color: #000; color: #fff; padding: 50px; text-align: center; min-height: 100vh;">
        <h1 style="color: #d4af37; font-size: 32px; text-transform: uppercase;">Account Activated! 🌹</h1>
        <p style="font-size: 16px; color: #ccc;">Thank you, ${user.name}! Your email address has been verified.</p>
        <div style="margin-top: 30px;">
          <a href="/sign-in?verified=true" style="background-color: #d4af37; color: #000; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 12px; text-transform: uppercase;">Sign In Now</a>
        </div>
      </div>
    `);
  } catch (err) {
    logger.error({ err }, "Verify email error");
    res.status(500).send("<h1>Internal server error</h1>");
  }
});

router.post("/auth/login", async (req: any, res: any) => {
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
        isVerified: user.isVerified ?? false,
      }
    });
  } catch (err) {
    logger.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
