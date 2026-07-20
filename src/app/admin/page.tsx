import Link from "next/link";
import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { money, timeAgo } from "@/lib/format";
import BanButton from "@/components/BanButton";
import TakeDownButton from "@/components/TakeDownButton";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  email: string;
  team_number: number;
  team_name: string;
  banned: number;
  created_at: number;
}

interface ListingRow {
  id: string;
  title: string;
  price_cents: number;
  status: string;
  created_at: number;
  team_number: number;
  team_name: string;
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  // Hide the panel entirely from non-admins.
  if (!user || !user.is_admin) notFound();

  const users = await q<UserRow>(
    "SELECT id, email, team_number, team_name, banned, created_at FROM users ORDER BY created_at DESC LIMIT 500"
  );
  const listings = await q<ListingRow>(
    `SELECT l.id, l.title, l.price_cents, l.status, l.created_at, u.team_number, u.team_name
       FROM listings l JOIN users u ON u.id = l.seller_id
      WHERE l.status != 'removed'
      ORDER BY l.created_at DESC LIMIT 500`
  );

  return (
    <div className="space-y-8">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Admin · The Clueless</h1>
        <span className="text-xs font-bold uppercase bg-orange-600 text-white rounded px-2 py-0.5">
          moderator
        </span>
        <Link href="/" className="link text-sm ml-auto">
          back to site
        </Link>
      </div>

      <section>
        <h2 className="font-bold text-lg mb-2">Teams ({users.length})</h2>
        <ul className="card divide-y divide-stone-200">
          {users.map((u) => {
            const admin = isAdminEmail(u.email);
            return (
              <li key={u.id} className="p-3 flex items-center gap-3 flex-wrap text-sm">
                <div className="min-w-0">
                  <span className="font-semibold">
                    {u.team_name} · Team {u.team_number}
                  </span>
                  {admin && (
                    <span className="ml-2 text-[10px] font-bold uppercase bg-orange-600 text-white rounded px-1.5 py-0.5">
                      admin
                    </span>
                  )}
                  {u.banned ? (
                    <span className="ml-2 text-[10px] font-bold uppercase bg-red-700 text-white rounded px-1.5 py-0.5">
                      banned
                    </span>
                  ) : null}
                  <p className="text-xs text-stone-400">
                    {u.email} · joined {timeAgo(u.created_at)}
                  </p>
                </div>
                <div className="ml-auto">
                  {!admin && <BanButton userId={u.id} banned={!!u.banned} />}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="font-bold text-lg mb-2">Listings ({listings.length})</h2>
        {listings.length === 0 ? (
          <p className="text-stone-500 text-sm">No active listings.</p>
        ) : (
          <ul className="card divide-y divide-stone-200">
            {listings.map((l) => (
              <li key={l.id} className="p-3 flex items-center gap-3 flex-wrap text-sm">
                <div className="min-w-0">
                  <Link href={`/listing/${l.id}`} className="font-semibold link">
                    {l.title}
                  </Link>
                  <p className="text-xs text-stone-400">
                    {money(l.price_cents)} · Team {l.team_number} · {l.status} · {timeAgo(l.created_at)}
                  </p>
                </div>
                <div className="ml-auto">
                  <TakeDownButton id={l.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
