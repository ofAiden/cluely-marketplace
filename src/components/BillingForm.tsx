"use client";

import { useState } from "react";

interface Initial {
  fullName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
}

export default function BillingForm({ initial }: { initial: Initial }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: f.get("fullName"),
          address1: f.get("address1"),
          address2: f.get("address2") ?? "",
          city: f.get("city"),
          state: f.get("state"),
          zip: f.get("zip"),
        }),
      });
      const data = await res.json();
      setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: data.error ?? "Could not save." });
    } catch {
      setMsg({ ok: false, text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-6 space-y-3">
      <label className="block">
        <span className="text-sm font-medium">Full name</span>
        <input className="field mt-1" name="fullName" defaultValue={initial.fullName} required minLength={2} maxLength={80} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Address line 1</span>
        <input className="field mt-1" name="address1" defaultValue={initial.address1} required minLength={3} maxLength={120} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Address line 2 (optional)</span>
        <input className="field mt-1" name="address2" defaultValue={initial.address2} maxLength={120} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block col-span-1">
          <span className="text-sm font-medium">City</span>
          <input className="field mt-1" name="city" defaultValue={initial.city} required maxLength={60} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">State</span>
          <input className="field mt-1" name="state" defaultValue={initial.state} required minLength={2} maxLength={2} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">ZIP</span>
          <input className="field mt-1" name="zip" defaultValue={initial.zip} required pattern="\d{5}(-\d{4})?" />
        </label>
      </div>
      {msg && (
        <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>
      )}
      <button className="btn w-full" disabled={busy}>
        {busy ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
