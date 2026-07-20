import { NextResponse } from "next/server";
import { qOne, run, type Order } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { idSchema } from "@/lib/validation";

/**
 * Completes a MOCK order (only exists when Stripe keys are not configured).
 * Only the buyer who created the pending order can complete it.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!idSchema.safeParse(body.orderId).success) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  const order = await qOne<Order>(
    "SELECT * FROM orders WHERE id = ? AND payment_provider = 'mock'",
    [body.orderId!]
  );
  if (!order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: "Order already processed." }, { status: 400 });
  }

  await run("UPDATE orders SET status = 'paid' WHERE id = ?", [order.id]);
  await run("UPDATE listings SET status = 'sold' WHERE id = ?", [order.listing_id]);
  return NextResponse.json({ ok: true });
}
