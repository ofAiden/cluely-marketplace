import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { q, qOne, type Listing } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { imageSrc } from "@/lib/uploads";
import EditListingForm from "@/components/EditListingForm";

export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const listing = await qOne<Listing>(
    "SELECT * FROM listings WHERE id = ? AND status != 'removed'",
    [id]
  );
  if (!listing) notFound();
  // Same rule as the API: seller or admin, and a 404 for anyone else.
  if (listing.seller_id !== user.id && !user.is_admin) notFound();

  const images = await q<{ filename: string }>(
    "SELECT filename FROM listing_images WHERE listing_id = ? ORDER BY position",
    [id]
  );

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/listing/${listing.id}`} className="link text-sm">
        ← back to the listing
      </Link>
      <h1 className="text-2xl font-bold mt-3 mb-1">Edit listing</h1>
      <p className="text-sm text-stone-500 mb-4">
        Changes show up for buyers right away. Your existing conversations stay open.
      </p>
      <EditListingForm
        listing={{
          id: listing.id,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          condition: listing.condition,
          price_cents: listing.price_cents,
          neighborhood: listing.neighborhood ?? "",
        }}
        photos={images.map((img) => ({ filename: img.filename, src: imageSrc(img.filename) }))}
      />
    </div>
  );
}
