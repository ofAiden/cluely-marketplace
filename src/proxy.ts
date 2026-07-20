import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Runs before every request (Next 16 "proxy", formerly middleware).
 *
 * Two jobs:
 *  1. CSRF defense: state-changing requests must have an Origin matching Host.
 *  2. Content-Security-Policy with a fresh per-request nonce. Script execution
 *     is limited to 'self' + this nonce (+ strict-dynamic so Next's own chunks,
 *     loaded by the nonced bootstrap, are trusted). This blocks injected inline
 *     scripts (XSS) while allowing Next's hydration to run — a static
 *     `script-src 'self'` would have blocked hydration and broken every form.
 */
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(request: NextRequest) {
  // 1) CSRF: Origin must match the Host we are serving.
  if (UNSAFE_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) {
      return new NextResponse(JSON.stringify({ error: "Invalid request origin" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // 2) CSP with a per-request nonce.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https://*.public.blob.vercel-storage.com;
    font-src 'self';
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
