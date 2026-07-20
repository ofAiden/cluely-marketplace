import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { googleConfigured, googleAuthUrl, GOOGLE_STATE_COOKIE } from "@/lib/google";

/** Kick off Google OAuth: set a state cookie and redirect to Google. */
export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=google-unavailable", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000")
    );
  }
  const state = crypto.randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(state));
}
