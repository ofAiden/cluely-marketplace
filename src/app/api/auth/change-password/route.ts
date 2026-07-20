import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { qOne, run, type User } from "@/lib/db";
import {
  getCurrentUser,
  hashPassword,
  verifyPassword,
  createSession,
  sessionCookieOptions,
  destroyAllSessions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { changePasswordSchema, firstError } from "@/lib/validation";

/** Signed-in password change. Requires the current password. */
export async function POST(req: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });

  const user = await qOne<User>("SELECT * FROM users WHERE id = ?", [current.id]);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  if (!user.password_hash) {
    return NextResponse.json(
      { error: "This account uses Google sign-in. Use “Forgot password” to set a password." },
      { status: 400 }
    );
  }
  if (!verifyPassword(parsed.data.currentPassword, user.password_hash)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  await run("UPDATE users SET password_hash = ? WHERE id = ?", [
    hashPassword(parsed.data.newPassword),
    user.id,
  ]);
  // Sign out everywhere, then re-issue a session for this device.
  await destroyAllSessions(user.id);
  const token = await createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
  return NextResponse.json({ ok: true });
}
