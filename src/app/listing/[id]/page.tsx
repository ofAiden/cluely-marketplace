import Link from "next/link";
import { notFound } from "next/navigation";
import { q, qOne, type Listing } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { money, timeAgo, labelize } from "@/lib/format";
import BuyButton from "@/components/BuyButton";

export const dynamic = "force-dynamic";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const listing = await qOne<
    Listing & { team_number: number; team_name: string; seller_email: string }
  >(
    `SELECT l.*, u.team_number, u.team_name, u.email AS seller_email
       FROM listings l JOIN users u ON u.id = l.seller_id
      WHERE l.id = ? AND l.status != 'removed'`,
    [id]
  );
  if (!listing) notFound();

  const images = await q<{ filename: string }>(
    "SELECT filename FROM listing_images WHERE listing_id = ? ORDER BY position",
    [id]
  );
  const user = await getCurrentUser();
  const isOwner = user?.id === listing.seller_id;
  const sold = listing.status === "sold";

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/" className="link text-sm">
        ← back to all parts
      </Link>

      <div className="card mt-3 p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{listing.title}</h1>
            <p className="text-sm text-stone-500 mt-1">
              {labelize(listing.condition)} · {labelize(listing.category)}
              {listing.neighborhood ? ` · ${listing.neighborhood}` : ""} · posted{" "}
              {timeAgo(listing.created_at)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-3xl font-extrabold text-orange-700">
              {listing.price_cents === 0 ? "Free" : money(listing.price_cents)}
            </div>
            {sold && (
              <span className="inline-block mt-1 text-xs font-bold uppercase bg-stone-800 text-white rounded px-2 py-0.5">
                Sold
              </span>
            )}
          </div>
        </div>

        {images.length > 0 && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.filename}
                src={`/api/images/${img.filename}`}
                alt={listing.title}
                className="rounded-lg border border-stone-200 object-cover w-full aspect-square"
              />
            ))}
          </div>
        )}

        <p className="mt-5 whitespace-pre-wrap leading-relaxed">{listing.description}</p>

        <div className="mt-6 border-t border-stone-200 pt-4 flex items-center gap-4 flex-wrap">
          <div className="text-sm">
            <div className="font-semibold">
              {listing.team_name} · Team {listing.team_number}
            </div>
            {user ? (
              <a className="link" href={`mailto:${listing.seller_email}`}>
                {listing.seller_email}
              </a>
            ) : (
              <span className="text-stone-500">
                <Link href="/login" className="link">
                  Sign in
                </Link>{" "}
                to see contact info
              </span>
            )}
          </div>
          <div className="ml-auto">
            {!sold && !isOwner && (
              <BuyButton
                listingId={listing.id}
                signedIn={!!user}
                free={listing.price_cents < 50}
              />
            )}
            {isOwner && (
              <Link href="/dashboard" className="btn-secondary btn">
                Manage in dashboard
              </Link>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-stone-400 mt-3">
        Safety tip from The Clueless: meet at league meets, scrimmages, or public
        places for pickups. Payments here run through Stripe test mode.
      </p>
    </div>
  );
}
