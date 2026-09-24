import nodemailer from "nodemailer";
import { logger } from "./logger";

export async function sendConfirmationEmail(email: string, name: string, verificationToken: string): Promise<boolean> {
  const domain = process.env.CANONICAL_URL || "https://www.intermingledapp.com";
  const verifyUrl = `${domain}/api/auth/verify-email?token=${verificationToken}`;

  const host = process.env.SMTP_HOST || "smtp.ionos.com";
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER || process.env.EMAIL_FROM_ADDRESS || "metal_rott@intermingledapp.com";
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM || `"Intermingled" <${user}>`;

  const subject = "Confirm your Intermingled Account 🌹";
  const text = `Hi ${name},\n\nPlease confirm your Intermingled account by clicking the link below:\n\n${verifyUrl}\n\nThis link will expire in 24 hours.\n\nBest,\nThe Intermingled Team`;
  const html = `
    <div style="font-family: sans-serif; background-color: #000; color: #fff; padding: 40px; text-align: center;">
      <h1 style="color: #d4af37; font-size: 28px; text-transform: uppercase;">Intermingled</h1>
      <p style="font-size: 16px; color: #ccc;">Hi <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #aaa;">Welcome to Intermingled! Please confirm your email address to activate your account and start speed dating.</p>
      <div style="margin: 30px 0;">
        <a href="${verifyUrl}" style="background-color: #d4af37; color: #000; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 12px; display: inline-block; text-transform: uppercase; font-size: 14px;">Confirm Account</a>
      </div>
      <p style="font-size: 12px; color: #666;">Or copy and paste this URL into your browser:<br/><a href="${verifyUrl}" style="color: #d4af37;">${verifyUrl}</a></p>
    </div>
  `;

  if (!pass) {
    logger.warn({ email, verifyUrl }, "SMTP_PASS not provided — logged confirmation URL for verification");
    console.log(`[EMAIL CONFIRMATION LINK] ${email} -> ${verifyUrl}`);
    return true;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 8000,
  });

  try {
    const info = await Promise.race([
      transporter.sendMail({ from, to: email, subject, text, html }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Email send timeout")), 8000))
    ]);
    logger.info({ messageId: (info as any).messageId, recipient: email }, "Confirmation email sent successfully");
    return true;
  } catch (err: any) {
    logger.error({ err, recipient: email }, "Failed to send confirmation email via SMTP");
    console.log(`[FALLBACK CONFIRMATION LINK] ${email} -> ${verifyUrl}`);
    return false;
  }
}
