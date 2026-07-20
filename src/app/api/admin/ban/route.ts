import { NextResponse } from "next/server";
import { qOne, run, type User } from "@/lib/db";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { banSchema, firstError } from "@/lib/validation";

/** Admin: ban or unban a user. Admins cannot be banned. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = banSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });

  const target = await qOne<User>("SELECT * FROM users WHERE id = ?", [parsed.data.userId]);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (isAdminEmail(target.email)) {
    return NextResponse.json({ error: "You can't ban an admin account." }, { status: 400 });
  }

  await run("UPDATE users SET banned = ? WHERE id = ?", [parsed.data.banned ? 1 : 0, target.id]);
  if (parsed.data.banned) {
    // Kick them out immediately by clearing their sessions.
    await run("DELETE FROM sessions WHERE user_id = ?", [target.id]);
  }
  return NextResponse.json({ ok: true });
}
