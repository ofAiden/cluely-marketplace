import { NextResponse } from "next/server";
import { unreadMessageCount } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Tiny endpoint behind the header's unread badge. It returns a single number,
 * so the badge can poll it cheaply instead of forcing a full page reload.
 * Signed-out visitors just get 0 rather than a 401 — the badge is cosmetic.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: await unreadMessageCount(user.id) });
}
