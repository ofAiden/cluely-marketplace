import { NextResponse } from "next/server";
import crypto from "crypto";
import { qOne, run, type User } from "@/lib/db";
import { newId } from "@/lib/auth";
import { forgotSchema, firstError } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { sendEmail, passwordResetEmail } from "@/lib/email";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Request a password reset. Always responds the same way whether or not the
 * email exists (anti-enumeration). Emails a reset link when the account exists
 * and Resend is configured.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });

  const user = await qOne<User>("SELECT * FROM users WHERE email = ?", [parsed.data.email]);
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = Date.now();
    // Invalidate any prior reset tokens for this user, then store the new one.
    await run("DELETE FROM password_resets WHERE user_id = ?", [user.id]);
    await run(
      "INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      [tokenHash, user.id, now, now + RESET_TTL_MS]
    );
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const mail = passwordResetEmail(`${base}/reset?token=${token}`);
    await sendEmail({ to: user.email, subject: mail.subject, html: mail.html });
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link is on its way.",
  });
}
