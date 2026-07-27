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

  // The accepted conversation is the record of who bought the part — `accept`
  // closes every other thread on that listing, so there is at most one.
  const myListings = await q<
    Listing & {
      conv_id: string | null;
      buyer_team_number: number | null;
      buyer_team_name: string | null;
      buyer_email: string | null;
    }
  >(
    `SELECT l.*,
            c.id    AS conv_id,
            b.team_number AS buyer_team_number,
            b.team_name   AS buyer_team_name,
            b.email       AS buyer_email
       FROM listings l
       LEFT JOIN conversations c ON c.listing_id = l.id AND c.status = 'accepted'
       LEFT JOIN users b ON b.id = c.buyer_id
      WHERE l.seller_id = ? AND l.status != 'removed'
      ORDER BY l.created_at DESC`,
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
        <div className="ml-auto flex gap-4 text-sm">
          <Link href="/messages" className="link">
            Messages{convCount && convCount.n > 0 ? ` (${convCount.n})` : ""}
          </Link>
          <Link href="/account/password" className="link">
            Change password
          </Link>
        </div>
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
                  {l.buyer_team_name && l.conv_id ? (
                    <p className="text-xs text-green-800 mt-0.5">
                      Sold to{" "}
                      <Link href={`/messages/${l.conv_id}`} className="link font-semibold">
                        {l.buyer_team_name} · Team {l.buyer_team_number}
                      </Link>
                      {l.buyer_email ? (
                        <>
                          {" "}
                          ·{" "}
                          <a className="link" href={`mailto:${l.buyer_email}`}>
                            {l.buyer_email}
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : l.status === "sold" ? (
                    <p className="text-xs text-stone-400 mt-0.5">
                      Marked sold by hand — open the buyer&apos;s{" "}
                      <Link href="/messages" className="link">
                        conversation
                      </Link>{" "}
                      and tap “Accept this buyer” to record who bought it.
                    </p>
                  ) : null}
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
