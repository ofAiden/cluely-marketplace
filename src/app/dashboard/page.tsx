import Link from "next/link";
import { redirect } from "next/navigation";
import { q, type Listing, type Order } from "@/lib/db";
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
  const myOrders = await q<Order & { title: string; team_number: number; seller_email: string }>(
    `SELECT o.*, l.title, u.team_number, u.email AS seller_email
       FROM orders o JOIN listings l ON l.id = o.listing_id JOIN users u ON u.id = l.seller_id
      WHERE o.buyer_id = ? ORDER BY o.created_at DESC`,
    [user.id]
  );
  const mySales = await q<Order & { title: string; buyer_team: number; buyer_email: string }>(
    `SELECT o.*, l.title, u.team_number AS buyer_team, u.email AS buyer_email
       FROM orders o JOIN listings l ON l.id = o.listing_id JOIN users u ON u.id = o.buyer_id
      WHERE l.seller_id = ? AND o.status = 'paid' ORDER BY o.created_at DESC`,
    [user.id]
  );

  return (
    <div className="space-y-8">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">
          {user.team_name} · Team {user.team_number}
        </h1>
        <Link href="/account/billing" className="link text-sm ml-auto">
          Billing &amp; pickup details →
        </Link>
      </div>

      <section>
        <h2 className="font-bold text-lg mb-2">Your listings</h2>
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

      <section>
        <h2 className="font-bold text-lg mb-2">Parts you bought</h2>
        {myOrders.length === 0 ? (
          <p className="text-stone-500 text-sm">No purchases yet.</p>
        ) : (
          <ul className="card divide-y divide-stone-200">
            {myOrders.map((o) => (
              <li key={o.id} className="p-3 flex items-center gap-3 flex-wrap text-sm">
                <div>
                  <span className="font-semibold">{o.title}</span>{" "}
                  <span className="text-stone-400">from Team {o.team_number}</span>
                  <p className="text-xs text-stone-400">
                    {money(o.amount_cents)} · {timeAgo(o.created_at)} ·{" "}
                    <span
                      className={
                        o.status === "paid"
                          ? "text-green-700 font-semibold"
                          : o.status === "cancelled"
                          ? "text-stone-400"
                          : "text-amber-600"
                      }
                    >
                      {o.status}
                    </span>
                  </p>
                </div>
                {o.status === "paid" && (
                  <a href={`mailto:${o.seller_email}`} className="link ml-auto">
                    email seller to arrange pickup
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-bold text-lg mb-2">Parts you sold</h2>
        {mySales.length === 0 ? (
          <p className="text-stone-500 text-sm">No sales yet.</p>
        ) : (
          <ul className="card divide-y divide-stone-200">
            {mySales.map((o) => (
              <li key={o.id} className="p-3 text-sm flex items-center gap-3 flex-wrap">
                <div>
                  <span className="font-semibold">{o.title}</span>{" "}
                  <span className="text-stone-400">to Team {o.buyer_team}</span>
                  <p className="text-xs text-stone-400">
                    {money(o.amount_cents)} · {timeAgo(o.created_at)}
                  </p>
                </div>
                <a href={`mailto:${o.buyer_email}`} className="link ml-auto">
                  email buyer
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
