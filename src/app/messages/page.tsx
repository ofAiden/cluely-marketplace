import Link from "next/link";
import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  status: string;
  last_message_at: number;
  title: string;
  listing_status: string;
  role: "buyer" | "seller";
  other_team: number;
  other_name: string;
  last_body: string | null;
}

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await q<Row>(
    `SELECT c.id, c.status, c.last_message_at, l.title, l.status AS listing_status,
            CASE WHEN c.buyer_id = ? THEN 'buyer' ELSE 'seller' END AS role,
            u.team_number AS other_team, u.team_name AS other_name,
            (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_body
       FROM conversations c
       JOIN listings l ON l.id = c.listing_id
       JOIN users u ON u.id = CASE WHEN c.buyer_id = ? THEN c.seller_id ELSE c.buyer_id END
      WHERE c.buyer_id = ? OR c.seller_id = ?
      ORDER BY c.last_message_at DESC
      LIMIT 100`,
    [user.id, user.id, user.id, user.id]
  );

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Messages</h1>
      <p className="text-sm text-stone-500 mb-4">
        Arrange pickups and payment in person. Meet at league meets, scrimmages, or public places.
      </p>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">
          No conversations yet.{" "}
          <Link href="/" className="link">
            Browse parts
          </Link>{" "}
          and message a seller to get started.
        </div>
      ) : (
        <ul className="card divide-y divide-stone-200">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/messages/${r.id}`} className="block p-3 hover:bg-orange-50/60 transition-colors">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold truncate">{r.title}</span>
                  {r.listing_status === "sold" && (
                    <span className="text-[10px] font-bold uppercase bg-stone-800 text-white rounded px-1.5 py-0.5">
                      sold
                    </span>
                  )}
                  <span className="ml-auto text-xs text-stone-400 whitespace-nowrap">
                    {timeAgo(r.last_message_at)}
                  </span>
                </div>
                <div className="text-sm text-stone-500 truncate">
                  {r.role === "buyer" ? "To" : "From"} {r.other_name} · Team {r.other_team}
                  {r.last_body ? ` — ${r.last_body}` : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
