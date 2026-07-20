import "server-only";
import crypto from "crypto";

export const GOOGLE_STATE_COOKIE = "g_state";
export const GOOGLE_PENDING_COOKIE = "g_pending";

/**
 * HMAC-sign a small payload so it can be round-tripped through a cookie without
 * the client tampering with it. Keyed on GOOGLE_CLIENT_SECRET, which is only
 * present when this flow is active.
 */
export function signPayload(obj: unknown): string {
  const data = Buffer.from(JSON.stringify(obj)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.GOOGLE_CLIENT_SECRET!)
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function verifyPayload<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = crypto
    .createHmac("sha256", process.env.GOOGLE_CLIENT_SECRET!)
    .update(data)
    .digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return JSON.parse(Buffer.from(data, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

/**
 * Google OAuth 2.0 (Authorization Code flow). Gated on GOOGLE_CLIENT_ID +
 * GOOGLE_CLIENT_SECRET. When unset, the "Continue with Google" button is
 * hidden and these helpers are never reached.
 */
export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

export function redirectUri(): string {
  return `${baseUrl()}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile {
  email: string;
  name: string;
  emailVerified: boolean;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile | null> {
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return null;
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return null;

    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    if (!infoRes.ok) return null;
    const info = (await infoRes.json()) as {
      email?: string;
      name?: string;
      email_verified?: boolean;
    };
    if (!info.email) return null;
    return {
      email: info.email.toLowerCase(),
      name: info.name ?? info.email.split("@")[0],
      emailVerified: !!info.email_verified,
    };
  } catch {
    return null;
  }
}
