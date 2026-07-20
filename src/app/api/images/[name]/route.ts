import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { UPLOAD_DIR, SAFE_IMAGE_NAME, mimeForName } from "@/lib/uploads";

/**
 * Serves uploaded images from outside the web root.
 * The filename must match a strict allowlist pattern (32 hex chars +
 * known image extension), which makes path traversal impossible.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> }
) {
  const { name } = await ctx.params;
  if (!SAFE_IMAGE_NAME.test(name)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const filePath = path.join(UPLOAD_DIR, name);
  try {
    const buf = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": mimeForName(name),
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
