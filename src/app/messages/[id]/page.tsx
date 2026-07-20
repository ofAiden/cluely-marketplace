import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { qOne, q, type Conversation, type Message } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { money } from "@/lib/format";
import MessageThread from "@/components/MessageThread";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const conv = await qOne<
    Conversation & {
      title: string;
      price_cents: number;
      listing_status: string;
      buyer_email: string;
      seller_email: string;
      buyer_team: number;
      seller_team: number;
    }
  >(
    `SELECT c.*, l.title, l.price_cents, l.status AS listing_status,
            b.email AS buyer_email, s.email AS seller_email,
            b.team_number AS buyer_team, s.team_number AS seller_team
       FROM conversations c
       JOIN listings l ON l.id = c.listing_id
       JOIN users b ON b.id = c.buyer_id
       JOIN users s ON s.id = c.seller_id
      WHERE c.id = ?`,
    [id]
  );
  if (!conv || (conv.buyer_id !== user.id && conv.seller_id !== user.id)) notFound();

  const isSeller = conv.seller_id === user.id;
  const messages = await q<Message>(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 500",
    [id]
  );
  const otherEmail = isSeller ? conv.buyer_email : conv.seller_email;
  const otherTeam = isSeller ? conv.buyer_team : conv.seller_team;

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/messages" className="link text-sm">
        ← all messages
      </Link>

      <div className="card mt-3 p-4 flex items-center gap-3 flex-wrap">
        <div className="min-w-0">
          <Link href={`/listing/${conv.listing_id}`} className="font-semibold link">
            {conv.title}
          </Link>
          <p className="text-xs text-stone-500">
            {conv.price_cents === 0 ? "Free" : money(conv.price_cents)} ·{" "}
            {isSeller ? "Buyer" : "Seller"}: Team {otherTeam}
            {conv.status === "accepted" ? " · accepted" : ""}
          </p>
        </div>
        <div className="ml-auto text-right">
          {conv.listing_status === "sold" ? (
            <span className="text-xs font-bold uppercase bg-stone-800 text-white rounded px-2 py-0.5">
              Sold
            </span>
          ) : null}
        </div>
      </div>

      <MessageThread
        conversationId={conv.id}
        currentUserId={user.id}
        isSeller={isSeller}
        listingSold={conv.listing_status === "sold"}
        accepted={conv.status === "accepted"}
        closed={conv.status === "closed"}
        initialMessages={messages}
        otherEmail={otherEmail}
      />
    </div>
  );
}
