import nodemailer from "nodemailer";
import { logger } from "./logger";

export async function sendConfirmationEmail(email: string, name: string, verificationToken: string): Promise<boolean> {
  const domain = process.env.CANONICAL_URL || "https://www.intermingledapp.com";
  const verifyUrl = `${domain}/api/auth/verify-email?token=${verificationToken}`;

  const resendApiKey = process.env.RESEND_API_KEY;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const user = process.env.SMTP_USER || process.env.EMAIL_FROM_ADDRESS || "metal_rott@intermingledapp.com";
  const from = process.env.EMAIL_FROM || `"Intermingled" <${user}>`;
  const host = process.env.SMTP_HOST || "smtp.ionos.com";
  const port = Number(process.env.SMTP_PORT || "587");

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

  // 1. Try Resend HTTP API if RESEND_API_KEY is present
  if (resendApiKey) {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: from.includes("<") ? from : `"Intermingled" <${from}>`,
          to: [email],
          subject,
          html,
          text,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (resp.ok) {
        logger.info({ email }, "Confirmation email sent via Resend API");
        return true;
      }
      const errText = await resp.text();
      logger.error({ status: resp.status, errText }, "Resend API returned error");
    } catch (err) {
      logger.error({ err }, "Resend API send failed");
    }
  }

  // 2. Try SMTP if pass is present
  if (pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 8000,
      });

      const info = await Promise.race([
        transporter.sendMail({ from, to: email, subject, text, html }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Email send timeout")), 8000))
      ]);
      logger.info({ messageId: (info as any).messageId, recipient: email }, "Confirmation email sent via SMTP");
      return true;
    } catch (err: any) {
      logger.error({ err, recipient: email }, "Failed to send confirmation email via SMTP");
    }
  }

  // 3. Fallback: Log URL for verification
  logger.warn({ email, verifyUrl }, "No email provider password configured — logged confirmation URL");
  console.log(`[EMAIL CONFIRMATION LINK] ${email} -> ${verifyUrl}`);
  return false;
}
