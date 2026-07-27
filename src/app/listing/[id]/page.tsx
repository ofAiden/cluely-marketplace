import Link from "next/link";
import { notFound } from "next/navigation";
import { q, qOne, type Listing } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { money, timeAgo, labelize } from "@/lib/format";
import { imageSrc } from "@/lib/uploads";
import MessageSellerButton from "@/components/MessageSellerButton";
import Description from "@/components/Description";
import TakeDownButton from "@/components/TakeDownButton";

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
  const isAdmin = !!user?.is_admin;
  const canRemove = isOwner || isAdmin;
  const canEdit = isOwner || isAdmin;
  const sold = listing.status === "sold";

  // Who bought it. Only the seller sees this — `accept` leaves exactly one
  // accepted conversation per listing, which is the record of the sale.
  const buyer =
    isOwner && sold
      ? await qOne<{
          conv_id: string;
          team_number: number;
          team_name: string;
          email: string;
        }>(
          `SELECT c.id AS conv_id, u.team_number, u.team_name, u.email
             FROM conversations c JOIN users u ON u.id = c.buyer_id
            WHERE c.listing_id = ? AND c.status = 'accepted'
            LIMIT 1`,
          [listing.id]
        )
      : null;

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/" className="link text-sm">
        ← back to all parts
      </Link>

      <div className="card mt-3 p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold break-words [overflow-wrap:anywhere]">
              {listing.title}
            </h1>
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

        {buyer && (
          <div className="card p-3 mt-4 bg-green-50 border-green-200 text-sm text-green-900">
            <strong>Sold to {buyer.team_name} · Team {buyer.team_number}.</strong>{" "}
            <Link href={`/messages/${buyer.conv_id}`} className="link">
              Open the conversation
            </Link>{" "}
            or email{" "}
            <a className="link" href={`mailto:${buyer.email}`}>
              {buyer.email}
            </a>{" "}
            to arrange the handoff.
          </div>
        )}

        {images.length > 0 && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.filename}
                src={imageSrc(img.filename)}
                alt={listing.title}
                className="rounded-lg border border-stone-200 object-cover w-full aspect-square"
              />
            ))}
          </div>
        )}

        <Description text={listing.description} />

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
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            {sold ? (
              <span className="text-sm font-semibold text-stone-500">No longer available</span>
            ) : isOwner ? (
              <Link href="/dashboard" className="btn-secondary btn">
                Manage in dashboard
              </Link>
            ) : (
              <MessageSellerButton listingId={listing.id} signedIn={!!user} />
            )}
            {canEdit && (
              <Link href={`/listing/${listing.id}/edit`} className="btn btn-secondary">
                Edit listing
              </Link>
            )}
            {canRemove && (
              <TakeDownButton
                id={listing.id}
                label={isOwner ? "Remove listing" : "Take down"}
                redirectTo={isOwner ? "/dashboard" : "/"}
                owner={isOwner}
              />
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-stone-400 mt-3">
        Safety tip from The Clueless: message the seller to agree on a price, then meet
        at a league meet, scrimmage, or public place to pay in person and pick up.
      </p>
    </div>
  );
}
