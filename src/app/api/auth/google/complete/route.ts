import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { qOne, run } from "@/lib/db";
import { createSession, sessionCookieOptions, SESSION_COOKIE, newId } from "@/lib/auth";
import { completeProfileSchema, firstError } from "@/lib/validation";
import { verifyPayload, GOOGLE_PENDING_COOKIE } from "@/lib/google";
import { sendEmail, registrationEmail } from "@/lib/email";

/** Finish a Google signup: create the account with the team details. */
export async function POST(req: Request) {
  const store = await cookies();
  const pending = verifyPayload<{ email: string; name: string }>(
    store.get(GOOGLE_PENDING_COOKIE)?.value
  );
  if (!pending) {
    return NextResponse.json({ error: "Your session expired. Please sign in with Google again." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = completeProfileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });

  // Guard against a race where the email got registered meanwhile.
  const existing = await qOne("SELECT id FROM users WHERE email = ?", [pending.email]);
  if (existing) {
    store.delete(GOOGLE_PENDING_COOKIE);
    return NextResponse.json({ error: "That email is already registered. Please sign in." }, { status: 400 });
  }

  const id = newId();
  // Google users have no password; password_hash stays empty (password login won't match).
  await run(
    "INSERT INTO users (id, email, password_hash, team_number, team_name, city, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, pending.email, "", parsed.data.teamNumber, parsed.data.teamName, parsed.data.city, Date.now()]
  );

  const token = await createSession(id);
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
  store.delete(GOOGLE_PENDING_COOKIE);

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const mail = registrationEmail(parsed.data.teamName, parsed.data.teamNumber, base);
  await sendEmail({ to: pending.email, subject: mail.subject, html: mail.html });

  return NextResponse.json({ ok: true });
}
