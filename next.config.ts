import type { NextConfig } from "next";

/**
 * Static security headers. The Content-Security-Policy is set per-request in
 * src/proxy.ts instead, so it can carry a fresh nonce (required for Next.js
 * hydration to execute). A static script-src 'self' would block hydration.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "nodemailer"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
