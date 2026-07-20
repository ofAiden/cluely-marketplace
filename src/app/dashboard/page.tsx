import Link from "next/link";
import { redirect } from "next/navigation";
import { q, qOne, type Listing } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { money, timeAgo } from "@/lib/format";
import ListingActions from "@/components/ListingActions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const myListings = await q<Listing>(
    "SELECT * FROM listings WHERE seller_id = ? AND status != 'removed' ORDER BY created_at DESC",
    [user.id]
  );
  const convCount = await qOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM conversations WHERE buyer_id = ? OR seller_id = ?",
    [user.id, user.id]
  );

  return (
    <div className="space-y-8">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">
          {user.team_name} · Team {user.team_number}
        </h1>
        <Link href="/messages" className="link text-sm ml-auto">
          Messages{convCount && convCount.n > 0 ? ` (${convCount.n})` : ""} →
        </Link>
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-bold text-lg">Your listings</h2>
          <Link href="/sell" className="link text-sm">
            + Post a part
          </Link>
        </div>
        {myListings.length === 0 ? (
          <p className="text-stone-500 text-sm">
            Nothing posted yet.{" "}
            <Link href="/sell" className="link">
              Post your first part →
            </Link>
          </p>
        ) : (
          <ul className="card divide-y divide-stone-200">
            {myListings.map((l) => (
              <li key={l.id} className="p-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0">
                  <Link href={`/listing/${l.id}`} className="font-semibold link">
                    {l.title}
                  </Link>
                  <p className="text-xs text-stone-400">
                    {money(l.price_cents)} · {timeAgo(l.created_at)} ·{" "}
                    <span className={l.status === "sold" ? "font-bold" : ""}>{l.status}</span>
                  </p>
                </div>
                <div className="ml-auto">
                  <ListingActions id={l.id} status={l.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4 text-sm text-stone-600">
        <strong>How selling works:</strong> buyers message you about a part. When you agree
        on a price, open the conversation and tap <em>Accept this buyer &amp; mark sold</em>.
        That reserves the part for them and closes other offers. Meet in person to pay and
        hand it off. No online payments, no fees.
      </section>
    </div>
  );
}
