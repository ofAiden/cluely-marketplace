import { NextResponse } from "next/server";
import { qOne, q, run, type Conversation, type Message } from "@/lib/db";
import { getCurrentUser, newId } from "@/lib/auth";
import { sendMessageSchema, idSchema, firstError } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/** Poll messages for a conversation the current user is part of. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const convId = new URL(req.url).searchParams.get("conversationId") ?? "";
  if (!idSchema.safeParse(convId).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const conv = await qOne<Conversation>("SELECT * FROM conversations WHERE id = ?", [convId]);
  if (!conv || (conv.buyer_id !== user.id && conv.seller_id !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const messages = await q<Message>(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 500",
    [convId]
  );
  return NextResponse.json({ messages, status: conv.status });
}

/** Send a message in an existing conversation. Only its buyer or seller may. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const rl = rateLimit(`msg:${user.id}:${clientIp(req)}`, 60, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many messages. Slow down a bit." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });

  const conv = await qOne<Conversation>("SELECT * FROM conversations WHERE id = ?", [
    parsed.data.conversationId,
  ]);
  if (!conv || (conv.buyer_id !== user.id && conv.seller_id !== user.id)) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  if (conv.status === "closed") {
    return NextResponse.json({ error: "This conversation is closed." }, { status: 400 });
  }

  const now = Date.now();
  await run(
    "INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
    [newId(), conv.id, user.id, parsed.data.body, now]
  );
  await run("UPDATE conversations SET last_message_at = ? WHERE id = ?", [now, conv.id]);
  return NextResponse.json({ ok: true });
}
