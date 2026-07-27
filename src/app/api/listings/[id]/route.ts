import { NextResponse } from "next/server";
import { q, qOne, run, type Listing } from "@/lib/db";
import { getCurrentUser, newId } from "@/lib/auth";
import { listingSchema, listingStatusSchema, idSchema, firstError } from "@/lib/validation";
import {
  saveImage,
  deleteImage,
  MAX_IMAGES_PER_LISTING,
  MAX_IMAGE_BYTES,
} from "@/lib/uploads";

/** Owner-only status changes (mark sold / remove / relist). */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = listingStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }

  const listing = await qOne<Listing>("SELECT * FROM listings WHERE id = ?", [id]);
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // AUTHORIZATION: the seller may change their own listing; an admin may change any.
  if (listing.seller_id !== user.id && !user.is_admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await run("UPDATE listings SET status = ? WHERE id = ?", [parsed.data.status, id]);
  return NextResponse.json({ ok: true });
}

/**
 * Edit a listing's details and photos. Multipart, same shape as the create
 * form plus `removeImages` (repeated field of filenames to drop).
 * Owner or admin only — the same rule the status PATCH uses.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const listing = await qOne<Listing>("SELECT * FROM listings WHERE id = ?", [id]);
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // AUTHORIZATION: 404 rather than 403 so this can't be used to probe for ids.
  if (listing.seller_id !== user.id && !user.is_admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (listing.status === "removed") {
    return NextResponse.json({ error: "This listing was removed." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = listingSchema.safeParse({
    title: form.get("title"),
    description: form.get("description"),
    category: form.get("category"),
    condition: form.get("condition"),
    priceCents: form.get("priceCents"),
    neighborhood: form.get("neighborhood") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }

  // Work out the photo set before writing anything, so a rejected upload
  // leaves the listing exactly as it was.
  const existing = await q<{ id: string; filename: string }>(
    "SELECT id, filename FROM listing_images WHERE listing_id = ? ORDER BY position",
    [id]
  );
  const dropping = new Set(form.getAll("removeImages").map(String));
  const keeping = existing.filter((img) => !dropping.has(img.filename));
  const removed = existing.filter((img) => dropping.has(img.filename));

  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (keeping.length + files.length > MAX_IMAGES_PER_LISTING) {
    return NextResponse.json(
      { error: `Max ${MAX_IMAGES_PER_LISTING} photos per listing.` },
      { status: 400 }
    );
  }
  for (const f of files) {
    if (f.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Each photo must be under 5 MB." }, { status: 400 });
    }
  }

  const savedNames: string[] = [];
  for (const f of files) {
    const name = await saveImage(Buffer.from(await f.arrayBuffer()));
    if (!name) {
      return NextResponse.json(
        { error: "Photos must be JPEG, PNG, or WebP images." },
        { status: 400 }
      );
    }
    savedNames.push(name);
  }

  const d = parsed.data;
  await run(
    `UPDATE listings
        SET title = ?, description = ?, category = ?, condition = ?,
            price_cents = ?, neighborhood = ?
      WHERE id = ?`,
    [d.title, d.description, d.category, d.condition, d.priceCents, d.neighborhood, id]
  );

  for (const img of removed) {
    await run("DELETE FROM listing_images WHERE id = ?", [img.id]);
    await deleteImage(img.filename); // best effort; never fails the edit
  }

  // Photo order, kept photos first then the new uploads. Position 0 is the
  // thumbnail everywhere (browse cards do ORDER BY position LIMIT 1), so
  // "make this the thumbnail" is really "move this to the front".
  const ordered: ({ rowId: string } | { newName: string })[] = [
    ...keeping.map((k) => ({ rowId: k.id })),
    ...savedNames.map((n) => ({ newName: n })),
  ];
  const thumbName = form.get("thumbnail");
  const thumbNew = form.get("thumbnailNew");
  let pick = -1;
  if (typeof thumbName === "string" && thumbName) {
    pick = keeping.findIndex((k) => k.filename === thumbName);
  } else if (typeof thumbNew === "string" && /^\d+$/.test(thumbNew)) {
    const n = Number(thumbNew);
    if (n < savedNames.length) pick = keeping.length + n;
  }
  if (pick > 0) ordered.unshift(...ordered.splice(pick, 1));

  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    if ("rowId" in item) {
      await run("UPDATE listing_images SET position = ? WHERE id = ?", [i, item.rowId]);
    } else {
      await run(
        "INSERT INTO listing_images (id, listing_id, filename, position) VALUES (?, ?, ?, ?)",
        [newId(), id, item.newName, i]
      );
    }
  }

  return NextResponse.json({ ok: true, id });
}
