"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BuyButton({
  listingId,
  signedIn,
  free,
}: {
  listingId: string;
  signedIn: boolean;
  free: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (free) {
    return <span className="text-sm text-stone-500">Contact the seller to arrange pickup</span>;
  }

  async function buy() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else if (data.redirect) {
        window.location.href = data.redirect;
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button className="btn" onClick={buy} disabled={busy}>
        {busy ? "Starting checkout…" : "Buy now"}
      </button>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
