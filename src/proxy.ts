import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Runs before every request (Next 16 "proxy", formerly middleware).
 *
 * CSRF defense-in-depth: for any state-changing method, the Origin header
 * must match the Host we are actually serving. Combined with SameSite=Lax
 * cookies, this blocks cross-site request forgery.
 *
 * (The Stripe webhook is exempt. It authenticates with a cryptographic
 * signature instead, and never uses cookies.)
 */
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(request: NextRequest) {
  if (
    UNSAFE_METHODS.has(request.method) &&
    request.nextUrl.pathname !== "/api/stripe/webhook"
  ) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) {
      return new NextResponse(JSON.stringify({ error: "Invalid request origin" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
