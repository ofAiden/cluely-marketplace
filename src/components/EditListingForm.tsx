"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_OPTIONS,
  CONDITION_OPTIONS,
  MAX_PHOTOS,
  compressImage,
  label,
} from "@/lib/listing-form";

export interface EditableListing {
  id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price_cents: number;
  neighborhood: string;
}

/** A photo the seller has picked but not saved yet. */
interface NewPhoto {
  key: string;
  file: File;
  url: string; // object URL, for the preview
}

/**
 * One tile in the photo grid. Declared at module scope on purpose: a component
 * defined inside the form would be a brand-new type on every render, so React
 * would unmount and remount every tile — and every <img> would reload.
 */
function Tile({
  src,
  selected,
  off,
  isNew,
  onPick,
  onToggle,
}: {
  src: string;
  selected: boolean;
  off: boolean;
  isNew: boolean;
  onPick: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className="relative rounded-lg overflow-hidden border-2 transition-all"
      style={{
        borderColor: off ? "#b91c1c" : selected ? "#ea580c" : "#e7e5e4",
        boxShadow: selected && !off ? "0 0 0 3px rgba(234,88,12,0.25)" : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`object-cover w-full aspect-square ${off ? "opacity-30" : ""}`}
      />

      {isNew && !off && (
        <span className="absolute top-1 left-1 text-[10px] font-bold uppercase bg-white/90 text-stone-700 rounded px-1 py-0.5">
          new
        </span>
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-label={off ? "Keep this photo" : "Remove this photo"}
        className="absolute top-1 right-1 w-6 h-6 rounded-full text-sm leading-none font-bold text-white flex items-center justify-center"
        style={{ background: off ? "#b91c1c" : "rgba(28,25,23,0.65)" }}
      >
        {off ? "↺" : "×"}
      </button>

      {off ? (
        <span className="absolute inset-x-0 bottom-0 text-[11px] font-semibold py-0.5 bg-red-700 text-white">
          Will be removed
        </span>
      ) : selected ? (
        <span className="absolute inset-x-0 bottom-0 text-[11px] font-bold py-0.5 bg-orange-600 text-white">
          ★ Thumbnail
        </span>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="absolute inset-x-0 bottom-0 text-[11px] font-semibold py-0.5 bg-stone-900/60 text-white hover:bg-stone-900/80"
        >
          Make thumbnail
        </button>
      )}
    </div>
  );
}

export default function EditListingForm({
  listing,
  photos,
}: {
  listing: EditableListing;
  photos: { filename: string; src: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Existing photos the seller has ticked off. Nothing is actually deleted
  // until save, so un-ticking gets the photo back.
  const [dropped, setDropped] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  // Which photo becomes position 0 — the thumbnail on the browse page.
  // "existing:<filename>" or "new:<key>". Defaults to whatever is first today.
  const [thumb, setThumb] = useState<string | null>(
    photos.length > 0 ? `existing:${photos[0].filename}` : null
  );
  const submitting = useRef(false);
  const keyCounter = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const kept = photos.filter((p) => !dropped.includes(p.filename));
  const total = kept.length + newPhotos.length;
  const room = MAX_PHOTOS - total;

  // Object URLs leak until they're revoked. removeNew() handles the one-off
  // case; this releases whatever is still outstanding when the page goes away.
  const live = useRef(newPhotos);
  live.current = newPhotos;
  useEffect(() => {
    return () => live.current.forEach((p) => URL.revokeObjectURL(p.url));
  }, []);

  function toggleDropped(filename: string) {
    const dropping = !dropped.includes(filename);
    setDropped(dropping ? [...dropped, filename] : dropped.filter((f) => f !== filename));
    // Don't leave the thumbnail pointing at a photo that's on its way out.
    if (dropping && thumb === `existing:${filename}`) setThumb(null);
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const picked = Array.from(list).slice(0, Math.max(0, room));
    setNewPhotos((prev) => [
      ...prev,
      ...picked.map((file) => ({
        key: `n${keyCounter.current++}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
    // Reset the input so picking the same file again still fires onChange.
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeNew(key: string) {
    setNewPhotos((prev) => {
      const gone = prev.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.key !== key);
    });
    if (thumb === `new:${key}`) setThumb(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return; // no double-saves
    submitting.current = true;
    setBusy(true);
    setError("");

    function stop(msg: string) {
      setError(msg);
      submitting.current = false;
      setBusy(false);
    }

    const f = new FormData(e.currentTarget);
    f.delete("newImages"); // the raw picker; we send from state instead

    const dollars = parseFloat((f.get("price") as string) || "0");
    if (isNaN(dollars) || dollars < 0 || dollars > 10000) {
      return stop("Price must be between $0 and $10,000.");
    }
    f.set("priceCents", String(Math.round(dollars * 100)));
    f.delete("price");

    if (total > MAX_PHOTOS) {
      return stop(`A listing can have at most ${MAX_PHOTOS} photos.`);
    }

    for (const filename of dropped) f.append("removeImages", filename);

    // Order matters: the server indexes `thumbnailNew` against these.
    for (const p of newPhotos) f.append("images", await compressImage(p.file));

    if (thumb?.startsWith("existing:")) {
      f.set("thumbnail", thumb.slice("existing:".length));
    } else if (thumb?.startsWith("new:")) {
      const i = newPhotos.findIndex((p) => `new:${p.key}` === thumb);
      if (i >= 0) f.set("thumbnailNew", String(i));
    }

    try {
      const res = await fetch(`/api/listings/${listing.id}`, { method: "PUT", body: f });
      const data = await res.json();
      if (!res.ok) return stop(data.error ?? "Could not save your changes.");
      router.push(`/listing/${listing.id}`);
      router.refresh();
    } catch {
      return stop("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Title</span>
        <input className="field mt-1" name="title" required minLength={4} maxLength={90}
          defaultValue={listing.title} />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Category</span>
          <select className="field mt-1" name="category" required defaultValue={listing.category}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{label(c)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Condition</span>
          <select className="field mt-1" name="condition" required defaultValue={listing.condition}>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c} value={c}>{label(c)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Price (USD)</span>
          <input className="field mt-1" name="price" type="number" step="0.01" min={0} max={10000}
            required defaultValue={(listing.price_cents / 100).toFixed(2)} />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea className="field mt-1 min-h-28" name="description" required minLength={10}
          maxLength={4000} defaultValue={listing.description} />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Area (optional)</span>
        <input className="field mt-1" name="neighborhood" maxLength={60}
          defaultValue={listing.neighborhood} placeholder="Poway, Mira Mesa, Chula Vista…" />
      </label>

      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium">Photos</span>
          <span className="text-xs text-stone-400">
            {total} of {MAX_PHOTOS}
          </span>
          <button
            type="button"
            className="btn btn-secondary !py-1 !px-2 text-xs ml-auto"
            disabled={room <= 0}
            onClick={() => fileInput.current?.click()}
          >
            {room > 0 ? `+ Add photos (${room} more)` : "Photo limit reached"}
          </button>
        </div>
        <p className="text-xs text-stone-500 mt-1 mb-2">
          Tap <strong>Make thumbnail</strong> to choose the picture teams see on the
          browse page — it gets the orange outline. Tap <strong>×</strong> to drop a
          photo; nothing is deleted until you save.
        </p>

        <input
          ref={fileInput}
          className="hidden"
          name="newImages"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => addFiles(e.currentTarget.files)}
        />

        {total === 0 ? (
          <p className="text-sm text-stone-400 border border-dashed border-stone-300 rounded-lg py-6 text-center">
            No photos yet. Listings with a photo get far more messages.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {photos.map((p) => {
              const off = dropped.includes(p.filename);
              return (
                <Tile
                  key={p.filename}
                  src={p.src}
                  off={off}
                  isNew={false}
                  selected={thumb === `existing:${p.filename}`}
                  onPick={() => setThumb(`existing:${p.filename}`)}
                  onToggle={() => toggleDropped(p.filename)}
                />
              );
            })}
            {newPhotos.map((p) => (
              <Tile
                key={p.key}
                src={p.url}
                off={false}
                isNew
                selected={thumb === `new:${p.key}`}
                onPick={() => setThumb(`new:${p.key}`)}
                onToggle={() => removeNew(p.key)}
              />
            ))}
          </div>
        )}

        {thumb === null && total > 0 && (
          <p className="text-xs text-stone-500 mt-2">
            No thumbnail picked — the first photo left will be used.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button className="btn flex-1" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => router.push(`/listing/${listing.id}`)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
