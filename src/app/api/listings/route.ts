import { NextResponse } from "next/server";
import { run, newIdSafe } from "@/lib/db-helpers";
import { getCurrentUser, newId } from "@/lib/auth";
import { listingSchema, firstError } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";
import { saveImage, MAX_IMAGES_PER_LISTING, MAX_IMAGE_BYTES } from "@/lib/uploads";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const rl = rateLimit(`listing:${user.id}`, 20, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many listings created. Slow down a bit." }, { status: 429 });
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

  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_IMAGES_PER_LISTING) {
    return NextResponse.json({ error: `Max ${MAX_IMAGES_PER_LISTING} photos.` }, { status: 400 });
  }
  for (const f of files) {
    if (f.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Each photo must be under 5 MB." }, { status: 400 });
    }
  }

  const savedNames: string[] = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const name = await saveImage(buf);
    if (!name) {
      return NextResponse.json(
        { error: "Photos must be JPEG, PNG, or WebP images." },
        { status: 400 }
      );
    }
    savedNames.push(name);
  }

  const id = newId();
  const d = parsed.data;
  await run(
    `INSERT INTO listings (id, seller_id, title, description, category, condition, price_cents, neighborhood, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [id, user.id, d.title, d.description, d.category, d.condition, d.priceCents, d.neighborhood, Date.now()]
  );
  for (let i = 0; i < savedNames.length; i++) {
    await run(
      "INSERT INTO listing_images (id, listing_id, filename, position) VALUES (?, ?, ?, ?)",
      [newIdSafe(), id, savedNames[i], i]
    );
  }

  return NextResponse.json({ ok: true, id });
}
