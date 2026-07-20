import { NextResponse } from "next/server";
import { qOne, type User } from "@/lib/db";
import {
  verifyPassword,
  createSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  recordFailedLogin,
  clearFailedLogins,
} from "@/lib/auth";
import { loginSchema, firstError } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { cookies } from "next/headers";

const GENERIC = "Incorrect email or password.";

export async function POST(req: Request) {
  const rl = rateLimit(`login:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await qOne<User>("SELECT * FROM users WHERE email = ?", [email]);
  if (!user) {
    // Burn comparable time to a real bcrypt check to resist timing probes.
    verifyPassword(password, "$2b$12$C6UzMDM.H6dfI/f/IKcEeO7ZBpUuCyyGVQmVXX0PXWnGXBUxrPOTC");
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  if (user.locked_until && user.locked_until > Date.now()) {
    return NextResponse.json(
      { error: "Account temporarily locked after too many failed logins. Try again later." },
      { status: 423 }
    );
  }

  if (!verifyPassword(password, user.password_hash)) {
    await recordFailedLogin(user.id);
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  if (user.banned) {
    return NextResponse.json(
      { error: "This account has been suspended by a moderator." },
      { status: 403 }
    );
  }

  await clearFailedLogins(user.id);
  const token = await createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
  return NextResponse.json({ ok: true });
}
