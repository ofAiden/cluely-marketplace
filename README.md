# SD FTC Parts Exchange

A Craigslist-style marketplace for **San Diego FTC teams** to buy and sell spare
robot parts. Built and run by **The Clueless · FTC Team 11212**.

Full stack: **Next.js 16 (App Router) + TypeScript + Tailwind + SQLite (libsql) + Stripe (test mode)**.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

That's it — the SQLite database (`data/market.db`) and upload folder are created
automatically on first run. No Stripe account needed to try it: without keys,
checkout uses a clearly-labeled mock payment page.

### Enable real Stripe test-mode payments

1. Copy `.env.example` to `.env.local`
2. Add your **test** secret key (`sk_test_...`) from dashboard.stripe.com
3. For webhooks locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   and put the printed `whsec_...` in `STRIPE_WEBHOOK_SECRET`
4. Use test card `4242 4242 4242 4242`, any future expiry, any CVC

## Features

- **Browse & search** — category sidebar, keyword search, price sorting (Craigslist-style rows)
- **Team accounts** — register with FTC team number; one account per team
- **Post a part** — title, category, condition, price, area, up to 6 photos
- **Purchase flow** — Buy Now → Stripe Checkout (test mode) or mock checkout; orders tracked in dashboard
- **Dashboard** — manage listings (mark sold / relist / remove), see purchases & sales, contact the other team
- **Billing details** — pickup/receipt info only; **card numbers never touch this server** (Stripe hosts payment)

## Security design

No website is "unhackable" — anyone who promises that is selling something.
What this app does is close every standard attack class with defense in depth:

| Threat | Defense |
|---|---|
| SQL injection | Every query is parameterized (libsql bind args); zero string-built SQL |
| XSS | React auto-escaping + strict Content-Security-Policy (`script-src 'self'`, no inline scripts) |
| CSRF | `SameSite=Lax` cookies **and** an Origin↔Host check on every state-changing request (`src/proxy.ts`) |
| Password theft | bcrypt (cost 12); plaintext never stored or logged |
| Session hijack | 256-bit random tokens, only the SHA-256 hash stored server-side; httpOnly + Secure cookies; 14-day expiry |
| Brute force | Per-IP rate limits on login/register + account lockout after 8 failed logins; timing-safe "user not found" path |
| Account enumeration | Identical generic errors for bad email vs bad password |
| Price tampering | Client sends only a listing ID — price always read from the DB server-side |
| Fake "payment complete" | With Stripe, orders are marked paid **only** by the signature-verified webhook; mock orders only by their own buyer, once |
| Malicious uploads | Magic-byte sniffing (JPEG/PNG/WebP only), 5 MB cap, random filenames, stored outside the web root, served with `nosniff` |
| Path traversal | Image route only serves names matching `^[a-f0-9]{32}\.(jpg|png|webp)$` |
| IDOR | Every mutation checks ownership (your listing, your order) before acting |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| Input abuse | Zod validation on every endpoint (lengths, enums, ranges, formats) |

**Before going truly public**, also: serve over HTTPS (automatic on Vercel/similar),
add email verification, move rate limiting to Redis if you run multiple instances,
keep `npm audit` clean, and never commit `.env.local`.

## Project layout

```
src/
  app/               pages + API route handlers
    api/             auth, listings, checkout, stripe webhook, billing, images
    listing/[id]/    listing detail
    sell/            post a part
    dashboard/       team dashboard
    account/billing/ billing & pickup details
    checkout/        success + mock checkout pages
  components/        client-side forms & buttons
  lib/               db, auth, validation, uploads, rate limiting, stripe
  proxy.ts           CSRF origin check (runs on every request)
data/                SQLite DB + uploaded images (created at runtime, git-ignored)
```

---
*Not affiliated with FIRST®. Payments run in Stripe test mode until you switch to live keys.*
