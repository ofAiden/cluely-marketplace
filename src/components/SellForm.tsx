"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  CATEGORY_OPTIONS as CATEGORIES,
  CONDITION_OPTIONS as CONDITIONS,
  compressImage,
  label,
} from "@/lib/listing-form";

export default function SellForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Synchronous re-entry guard. `busy` state only disables the button on the
  // NEXT render, so a fast double-click can fire two submits before React
  // repaints — especially since we await image compression before POSTing.
  // A ref flips immediately, so the second submit is dropped outright.
  const submitting = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return; // already posting — ignore the extra click
    submitting.current = true;
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const f = new FormData(form);

    // Convert dollars -> integer cents before sending.
    const dollars = parseFloat((f.get("price") as string) || "0");
    if (isNaN(dollars) || dollars < 0 || dollars > 10000) {
      setError("Price must be between $0 and $10,000.");
      submitting.current = false;
      setBusy(false);
      return;
    }
    f.set("priceCents", String(Math.round(dollars * 100)));
    f.delete("price");

    // Compress photos client-side before upload.
    const files = f.getAll("images").filter((x): x is File => x instanceof File && x.size > 0);
    f.delete("images");
    for (const file of files) {
      f.append("images", await compressImage(file));
    }

    try {
      const res = await fetch("/api/listings", { method: "POST", body: f });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create listing.");
        submitting.current = false;
        setBusy(false);
      } else {
        // Success: stay disabled through the navigation so the form can't be
        // resubmitted while the new listing page is loading.
        router.push(`/listing/${data.id}`);
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
          placeholder="REV Core Hex Motor, pair, barely used" />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Category</span>
          <select className="field mt-1" name="category" required defaultValue="motors">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{label(c)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Condition</span>
          <select className="field mt-1" name="condition" required defaultValue="used">
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{label(c)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Price (USD)</span>
          <input className="field mt-1" name="price" type="number" step="0.01" min={0} max={10000}
            required placeholder="15.00" />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea className="field mt-1 min-h-28" name="description" required minLength={10} maxLength={4000}
          placeholder="What is it, how many, what condition, pickup preferences…" />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Area (optional)</span>
        <input className="field mt-1" name="neighborhood" maxLength={60}
          placeholder="Poway, Mira Mesa, Chula Vista…" />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Photos (up to 6, JPEG/PNG/WebP, 5 MB each)</span>
        <input className="field mt-1" name="images" type="file" multiple
          accept="image/jpeg,image/png,image/webp" />
        <span className="text-xs text-stone-500 mt-1 block">
          The first one is the thumbnail teams see while browsing — you can change
          which one, and add more, by editing the listing afterwards.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn w-full" disabled={busy}>
        {busy ? "Posting…" : "Post listing"}
      </button>
    </form>
  );
}
