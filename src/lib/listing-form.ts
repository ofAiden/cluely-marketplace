/**
 * Browser-side bits shared by the "post a part" and "edit listing" forms.
 * Deliberately free of any server imports so it can be pulled into client
 * components (src/lib/db.ts touches fs/path and cannot be).
 */

export const CATEGORY_OPTIONS = [
  "motors", "servos", "wheels", "structure", "electronics",
  "sensors", "hardware", "gears-belts", "control-hubs", "other",
];

export const CONDITION_OPTIONS = ["new", "like-new", "used", "for-parts"];

export const MAX_PHOTOS = 6;

export function label(s: string): string {
  return s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Downscale photos in the browser (max 1280px, JPEG q0.82) so the whole
 * upload stays comfortably under serverless request-size limits.
 * Falls back to the original file if anything goes wrong.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    if (file.size < 400 * 1024) return file; // already small
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, "image/jpeg", 0.82)
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
