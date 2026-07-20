import "server-only";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

/**
 * Image uploads.
 * - Stored OUTSIDE the web root (data/uploads) and served through a
 *   controlled route handler — never executed, never path-traversable.
 * - Type is verified by MAGIC BYTES, not by the client-supplied name
 *   or content-type (both are attacker-controlled).
 * - Random hex filenames; the original filename is discarded entirely.
 */

export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMAGES_PER_LISTING = 6;

const SIGNATURES: { ext: string; mime: string; check: (b: Buffer) => boolean }[] = [
  {
    ext: "jpg",
    mime: "image/jpeg",
    check: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "png",
    mime: "image/png",
    check: (b) =>
      b.length > 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    ext: "webp",
    mime: "image/webp",
    check: (b) =>
      b.length > 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
];

export function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  for (const sig of SIGNATURES) if (sig.check(buf)) return { ext: sig.ext, mime: sig.mime };
  return null;
}

/**
 * Saves a validated image and returns either a full https URL (Vercel Blob,
 * production) or a bare filename (local disk fallback for development).
 */
export async function saveImage(buf: Buffer): Promise<string | null> {
  if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;
  const kind = sniffImage(buf);
  if (!kind) return null;
  const name = `${crypto.randomBytes(16).toString("hex")}.${kind.ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`listings/${name}`, buf, {
      access: "public",
      contentType: kind.mime,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf, { flag: "wx" });
  return name;
}

/** Resolve a stored image reference (blob URL or local filename) to a src. */
export function imageSrc(ref: string): string {
  return ref.startsWith("https://") ? ref : `/api/images/${ref}`;
}

/** Strict allowlist for serving: 32 hex chars + known extension. */
export const SAFE_IMAGE_NAME = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

export function mimeForName(name: string): string {
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
