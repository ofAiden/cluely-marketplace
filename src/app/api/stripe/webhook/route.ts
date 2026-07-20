import { NextResponse } from "next/server";
import { qOne, run, type Order } from "@/lib/db";
import { getStripe, stripeWebhookSecret } from "@/lib/stripe";

/**
 * Stripe webhook: the ONLY place an order is marked paid when Stripe is
 * configured. Authenticated by verifying Stripe's cryptographic signature
 * on the raw body; requests without a valid signature are rejected.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = stripeWebhookSecret();
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      const order = await qOne<Order>(
        "SELECT * FROM orders WHERE id = ? AND stripe_session_id = ?",
        [orderId, session.id]
      );
      if (order && order.status === "pending") {
        await run("UPDATE orders SET status = 'paid' WHERE id = ?", [order.id]);
        await run("UPDATE listings SET status = 'sold' WHERE id = ?", [order.listing_id]);
      }
    }
  }

  return NextResponse.json({ received: true });
}
