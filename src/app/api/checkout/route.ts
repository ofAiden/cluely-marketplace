import { NextResponse } from "next/server";
import { qOne, run, type Listing } from "@/lib/db";
import { getCurrentUser, newId } from "@/lib/auth";
import { checkoutSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { getStripe } from "@/lib/stripe";

/**
 * Starts a purchase. Price ALWAYS comes from the database. The client
 * only sends a listing id, so tampering with the amount is impossible.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to buy." }, { status: 401 });

  const rl = rateLimit(`checkout:${user.id}:${clientIp(req)}`, 15, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many checkout attempts." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid listing." }, { status: 400 });

  const listing = await qOne<Listing>(
    "SELECT * FROM listings WHERE id = ? AND status = 'active'",
    [parsed.data.listingId]
  );
  if (!listing) {
    return NextResponse.json({ error: "This listing is no longer available." }, { status: 404 });
  }
  if (listing.seller_id === user.id) {
    return NextResponse.json({ error: "You can't buy your own listing." }, { status: 400 });
  }
  if (listing.price_cents < 50) {
    // Stripe minimum charge is $0.50; free/cheap parts are contact-only.
    return NextResponse.json(
      { error: "This part is free or under $0.50. Contact the seller instead." },
      { status: 400 }
    );
  }

  const orderId = newId();
  const stripe = getStripe();
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  if (!stripe) {
    // Mock checkout (no Stripe keys configured): clearly-labeled test flow.
    await run(
      `INSERT INTO orders (id, listing_id, buyer_id, amount_cents, status, payment_provider, created_at)
       VALUES (?, ?, ?, ?, 'pending', 'mock', ?)`,
      [orderId, listing.id, user.id, listing.price_cents, Date.now()]
    );
    return NextResponse.json({ ok: true, redirect: `/checkout/mock?order=${orderId}` });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: listing.price_cents, // server-side price, never from client
          product_data: {
            name: listing.title.slice(0, 100),
            description: "FTC part from SD FTC Parts Exchange",
          },
        },
        quantity: 1,
      },
    ],
    metadata: { orderId, listingId: listing.id, buyerId: user.id },
    success_url: `${base}/checkout/success?order=${orderId}`,
    cancel_url: `${base}/listing/${listing.id}?cancelled=1`,
  });

  await run(
    `INSERT INTO orders (id, listing_id, buyer_id, amount_cents, status, payment_provider, stripe_session_id, created_at)
     VALUES (?, ?, ?, ?, 'pending', 'stripe', ?, ?)`,
    [orderId, listing.id, user.id, listing.price_cents, session.id, Date.now()]
  );

  return NextResponse.json({ ok: true, redirect: session.url });
}
