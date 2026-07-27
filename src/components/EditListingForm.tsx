"use client";

import { useRef, useState } from "react";
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
  // Photos the seller has ticked off. Nothing is actually deleted until save,
  // so un-ticking gets the photo back.
  const [dropped, setDropped] = useState<string[]>([]);
  const [adding, setAdding] = useState(0);
  const submitting = useRef(false);

  const keeping = photos.filter((p) => !dropped.includes(p.filename)).length;
  const room = MAX_PHOTOS - keeping - adding;

  function togglePhoto(filename: string) {
    setDropped((d) =>
      d.includes(filename) ? d.filter((f) => f !== filename) : [...d, filename]
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return; // no double-saves
    submitting.current = true;
    setBusy(true);
    setError("");

    const f = new FormData(e.currentTarget);

    const dollars = parseFloat((f.get("price") as string) || "0");
    if (isNaN(dollars) || dollars < 0 || dollars > 10000) {
      setError("Price must be between $0 and $10,000.");
      submitting.current = false;
      setBusy(false);
      return;
    }
    f.set("priceCents", String(Math.round(dollars * 100)));
    f.delete("price");

    for (const filename of dropped) f.append("removeImages", filename);

    const files = f.getAll("images").filter((x): x is File => x instanceof File && x.size > 0);
    f.delete("images");
    if (keeping + files.length > MAX_PHOTOS) {
      setError(`A listing can have at most ${MAX_PHOTOS} photos.`);
      submitting.current = false;
      setBusy(false);
      return;
    }
    for (const file of files) f.append("images", await compressImage(file));

    try {
      const res = await fetch(`/api/listings/${listing.id}`, { method: "PUT", body: f });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save your changes.");
        submitting.current = false;
        setBusy(false);
      } else {
        router.push(`/listing/${listing.id}`);
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
      submitting.current = false;
      setBusy(false);
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

      {photos.length > 0 && (
        <div>
          <span className="text-sm font-medium">Current photos</span>
          <p className="text-xs text-stone-500 mb-2">
            Tap a photo to mark it for removal. Nothing is deleted until you save.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {photos.map((p) => {
              const off = dropped.includes(p.filename);
              return (
                <button
                  key={p.filename}
                  type="button"
                  onClick={() => togglePhoto(p.filename)}
                  aria-pressed={off}
                  className="relative rounded-lg overflow-hidden border-2 transition-all"
                  style={{ borderColor: off ? "#b91c1c" : "#e7e5e4" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt="" className={`object-cover w-full aspect-square ${off ? "opacity-30" : ""}`} />
                  <span
                    className={`absolute inset-x-0 bottom-0 text-[11px] font-semibold py-0.5 ${
                      off ? "bg-red-700 text-white" : "bg-stone-900/60 text-white"
                    }`}
                  >
                    {off ? "Will be removed" : "Remove"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium">
          Add photos {room > 0 ? `(room for ${room} more)` : "(limit reached)"}
        </span>
        <input
          className="field mt-1"
          name="images"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={room <= 0}
          onChange={(e) => setAdding(e.currentTarget.files?.length ?? 0)}
        />
      </label>

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
