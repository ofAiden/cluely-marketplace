import { NextResponse } from "next/server";
import { qOne, run, type Conversation, type Listing } from "@/lib/db";
import { getCurrentUser, newId } from "@/lib/auth";
import { idSchema } from "@/lib/validation";

/**
 * Seller accepts this buyer: the listing is marked sold and reserved for them,
 * and other open conversations on the same listing are closed. Only the seller
 * of the listing may do this.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const conv = await qOne<Conversation>("SELECT * FROM conversations WHERE id = ?", [id]);
  if (!conv || conv.seller_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const listing = await qOne<Listing>("SELECT * FROM listings WHERE id = ?", [conv.listing_id]);
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  if (listing.status === "removed") {
    return NextResponse.json({ error: "This listing was removed." }, { status: 400 });
  }

  const now = Date.now();
  await run("UPDATE listings SET status = 'sold' WHERE id = ?", [listing.id]);
  await run("UPDATE conversations SET status = 'accepted', last_message_at = ? WHERE id = ?", [now, conv.id]);
  // Close the seller's other open threads on this listing.
  await run(
    "UPDATE conversations SET status = 'closed' WHERE listing_id = ? AND id != ? AND status = 'open'",
    [listing.id, conv.id]
  );
  // Post a system-style note from the seller into the accepted thread.
  await run(
    "INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
    [newId(), conv.id, user.id, "✅ I've accepted your offer and marked this part sold. Let's arrange a pickup!", now]
  );
  return NextResponse.json({ ok: true });
}
