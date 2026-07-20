import { NextResponse } from "next/server";
import { qOne, run } from "@/lib/db";
import {
  hashPassword,
  createSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  newId,
} from "@/lib/auth";
import { registerSchema, firstError } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 15 * 60 * 1000);
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
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }
  const { email, password, teamNumber, teamName, city } = parsed.data;

  const existing = await qOne("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) {
    // Same generic wording as other auth failures to limit account enumeration.
    return NextResponse.json(
      { error: "Unable to register with those details." },
      { status: 400 }
    );
  }

  const id = newId();
  await run(
    "INSERT INTO users (id, email, password_hash, team_number, team_name, city, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, email, hashPassword(password), teamNumber, teamName, city, Date.now()]
  );

  const token = await createSession(id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
  return NextResponse.json({ ok: true });
}
