import { NextResponse } from "next/server";
import crypto from "crypto";
import { qOne, run } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { resetSchema, firstError } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/** Complete a password reset with a valid, unexpired token. */
export async function POST(req: Request) {
  const rl = rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const row = await qOne<{ user_id: string; expires_at: number }>(
    "SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?",
    [tokenHash]
  );
  if (!row || row.expires_at < Date.now()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  await run("UPDATE users SET password_hash = ?, banned = banned WHERE id = ?", [
    hashPassword(parsed.data.newPassword),
    row.user_id,
  ]);
  // One-time use: clear this user's reset tokens and sign out all sessions.
  await run("DELETE FROM password_resets WHERE user_id = ?", [row.user_id]);
  await run("DELETE FROM sessions WHERE user_id = ?", [row.user_id]);

  return NextResponse.json({ ok: true });
}
