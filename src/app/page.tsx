import Link from "next/link";
import { q, CATEGORIES, type ListingWithMeta } from "@/lib/db";
import { money, timeAgo, labelize } from "@/lib/format";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  category?: string;
  sort?: string;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const search = (sp.q ?? "").slice(0, 100).trim();
  const category = CATEGORIES.includes(sp.category as (typeof CATEGORIES)[number])
    ? sp.category!
    : "";
  const sort = sp.sort === "low" ? "low" : sp.sort === "high" ? "high" : "new";

  const where: string[] = ["l.status = 'active'"];
  const args: (string | number)[] = [];
  if (search) {
    where.push("(l.title LIKE ? OR l.description LIKE ?)");
    const like = `%${search.replace(/[%_]/g, "")}%`;
    args.push(like, like);
  }
  if (category) {
    where.push("l.category = ?");
    args.push(category);
  }
  const orderBy =
    sort === "low" ? "l.price_cents ASC" : sort === "high" ? "l.price_cents DESC" : "l.created_at DESC";

  const listings = await q<ListingWithMeta>(
    `SELECT l.*, u.team_number, u.team_name,
            (SELECT filename FROM listing_images i WHERE i.listing_id = l.id ORDER BY position LIMIT 1) AS thumb
       FROM listings l JOIN users u ON u.id = l.seller_id
      WHERE ${where.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT 100`,
    args
  );

  return (
    <div>
      <div className="mb-6 rounded-xl bg-gradient-to-r from-stone-900 to-stone-800 text-white p-5 flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Spare FTC parts, <span className="text-orange-500">San Diego prices</span>
          </h1>
          <p className="text-stone-300 text-sm mt-1">
            A parts exchange for San Diego FTC teams — built and run by{" "}
            <span className="font-semibold text-orange-400">The Clueless · Team 11212</span>
          </p>
        </div>
        <Link href="/sell" className="btn ml-auto">
          + Post a part
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
        {/* Sidebar — craigslist-style category list */}
        <aside>
          <form action="/" className="mb-4 flex gap-2">
            <input
              className="field"
              type="search"
              name="q"
              defaultValue={search}
              placeholder="search parts…"
              maxLength={100}
            />
          </form>
          <h2 className="font-bold text-sm uppercase tracking-wide text-stone-500 mb-2">
            Categories
          </h2>
          <ul className="space-y-1 text-[15px]">
            <li>
              <Link href="/" className={!category ? "font-bold text-orange-700" : "link"}>
                all parts
              </Link>
            </li>
            {CATEGORIES.map((c) => (
              <li key={c}>
                <Link
                  href={`/?category=${c}`}
                  className={category === c ? "font-bold text-orange-700" : "link"}
                >
                  {labelize(c).toLowerCase()}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 card p-3 text-xs text-stone-600 leading-relaxed">
            <strong>How it works:</strong> teams post spare parts, other San Diego
            teams buy or arrange pickup. Meet at scrimmages, league meets, or
            public places.
          </div>
        </aside>

        {/* Listing rows */}
        <section>
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-xl font-bold">
              {category ? labelize(category) : "All parts"}{" "}
              <span className="text-stone-400 font-normal text-base">
                · {listings.length} listing{listings.length === 1 ? "" : "s"}
                {search ? ` matching “${search}”` : ""}
              </span>
            </h2>
            <nav className="text-sm flex gap-3">
              {[
                ["new", "newest"],
                ["low", "price ↑"],
                ["high", "price ↓"],
              ].map(([key, label]) => (
                <Link
                  key={key}
                  href={`/?${new URLSearchParams({
                    ...(search ? { q: search } : {}),
                    ...(category ? { category } : {}),
                    sort: key,
                  }).toString()}`}
                  className={sort === key ? "font-bold text-orange-700" : "link"}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {listings.length === 0 ? (
            <div className="card p-10 text-center text-stone-500">
              No parts listed yet{search || category ? " for this search" : ""}.{" "}
              <Link className="link" href="/sell">
                Be the first to post one →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-stone-200 card">
              {listings.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/listing/${l.id}`}
                    className="flex gap-4 p-3 hover:bg-orange-50/60 transition-colors"
                  >
                    <div className="w-20 h-20 shrink-0 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center text-stone-300 text-2xl">
                      {l.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/images/${l.thumb}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        "⚙"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold truncate">{l.title}</span>
                        <span className="ml-auto font-bold text-orange-700 whitespace-nowrap">
                          {l.price_cents === 0 ? "free" : money(l.price_cents)}
                        </span>
                      </div>
                      <p className="text-sm text-stone-500 truncate">{l.description}</p>
                      <p className="text-xs text-stone-400 mt-1">
                        {labelize(l.condition)} · {labelize(l.category)} · Team{" "}
                        {l.team_number}
                        {l.neighborhood ? ` · ${l.neighborhood}` : ""} ·{" "}
                        {timeAgo(l.created_at)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
