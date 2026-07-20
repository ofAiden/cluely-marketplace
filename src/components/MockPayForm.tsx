"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MockPayForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout/mock-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Payment failed.");
      else router.push(`/checkout/success?order=${orderId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <label className="block">
        <span className="text-sm font-medium">Card number (test)</span>
        <input className="field mt-1" placeholder="4242 4242 4242 4242" disabled value="4242 4242 4242 4242" readOnly />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <input className="field" placeholder="MM/YY" value="12/34" readOnly disabled />
        <input className="field" placeholder="CVC" value="123" readOnly disabled />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn w-full" onClick={pay} disabled={busy}>
        {busy ? "Processing…" : "Pay (test mode)"}
      </button>
    </div>
  );
}
