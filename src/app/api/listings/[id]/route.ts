import { NextResponse } from "next/server";
import { qOne, run, type Listing } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { listingStatusSchema, idSchema, firstError } from "@/lib/validation";

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

  // AUTHORIZATION: only the seller may change their listing.
  if (listing.seller_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await run("UPDATE listings SET status = ? WHERE id = ?", [parsed.data.status, id]);
  return NextResponse.json({ ok: true });
}
