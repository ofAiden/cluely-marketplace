import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { qOne, type User } from "@/lib/db";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import {
  googleConfigured,
  exchangeCodeForProfile,
  signPayload,
  GOOGLE_STATE_COOKIE,
  GOOGLE_PENDING_COOKIE,
  baseUrl,
} from "@/lib/google";

/** Google redirects here with ?code&state. Verify, then sign in or send to profile completion. */
export async function GET(req: Request) {
  const base = baseUrl();
  if (!googleConfigured()) return NextResponse.redirect(new URL("/login?error=google-unavailable", base));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get(GOOGLE_STATE_COOKIE)?.value;
  store.delete(GOOGLE_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=google", base));
  }

  const profile = await exchangeCodeForProfile(code);
  if (!profile || !profile.emailVerified) {
    return NextResponse.redirect(new URL("/login?error=google", base));
  }

  const existing = await qOne<User>("SELECT * FROM users WHERE email = ?", [profile.email]);
  if (existing) {
    const token = await createSession(existing.id);
    store.set(SESSION_COOKIE, token, sessionCookieOptions());
    return NextResponse.redirect(new URL("/", base));
  }

  // New user: stash a signed profile and collect team details.
  store.set(GOOGLE_PENDING_COOKIE, signPayload({ email: profile.email, name: profile.name }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 900,
  });
  return NextResponse.redirect(new URL("/register/complete", base));
}
