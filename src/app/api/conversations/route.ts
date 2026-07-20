import { NextResponse } from "next/server";
import { qOne, run, type Listing, type Conversation } from "@/lib/db";
import { getCurrentUser, newId } from "@/lib/auth";
import { startConversationSchema, firstError } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * Buyer starts (or re-opens) a conversation with a seller about a listing,
 * sending an opening message. One conversation per (listing, buyer).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to message a seller." }, { status: 401 });

  const rl = rateLimit(`conv:${user.id}:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many messages. Slow down a bit." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = startConversationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });

  const listing = await qOne<Listing>(
    "SELECT * FROM listings WHERE id = ? AND status != 'removed'",
    [parsed.data.listingId]
  );
  if (!listing) return NextResponse.json({ error: "This listing is no longer available." }, { status: 404 });
  if (listing.seller_id === user.id) {
    return NextResponse.json({ error: "This is your own listing." }, { status: 400 });
  }

  const now = Date.now();
  let conv = await qOne<Conversation>(
    "SELECT * FROM conversations WHERE listing_id = ? AND buyer_id = ?",
    [listing.id, user.id]
  );
  if (!conv) {
    const id = newId();
    await run(
      `INSERT INTO conversations (id, listing_id, buyer_id, seller_id, status, created_at, last_message_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?)`,
      [id, listing.id, user.id, listing.seller_id, now, now]
    );
    conv = { id, listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id, status: "open", created_at: now, last_message_at: now };
  }

  await run(
    "INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
    [newId(), conv.id, user.id, parsed.data.body, now]
  );
  await run("UPDATE conversations SET last_message_at = ? WHERE id = ?", [now, conv.id]);

  return NextResponse.json({ ok: true, conversationId: conv.id });
}
