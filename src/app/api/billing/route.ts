import { NextResponse } from "next/server";
import { run } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { billingSchema, firstError } from "@/lib/validation";

/**
 * Saves billing/pickup contact details. NOTE: card numbers are never
 * collected or stored by this app — payment details live only with Stripe.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = billingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;

  await run(
    `INSERT INTO billing_details (user_id, full_name, address1, address2, city, state, zip, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       full_name = excluded.full_name,
       address1 = excluded.address1,
       address2 = excluded.address2,
       city = excluded.city,
       state = excluded.state,
       zip = excluded.zip,
       updated_at = excluded.updated_at`,
    [user.id, d.fullName, d.address1, d.address2, d.city, d.state, d.zip, Date.now()]
  );
  return NextResponse.json({ ok: true });
}
