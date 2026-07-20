"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompleteProfileForm({ suggestedName }: { suggestedName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/google/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamNumber: f.get("teamNumber"),
          teamName: f.get("teamName"),
          city: f.get("city") || "San Diego",
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not finish signup.");
      else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Team number</span>
          <input className="field mt-1" name="teamNumber" type="number" min={1} max={99999} required placeholder="11212" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Team name</span>
          <input className="field mt-1" name="teamName" required maxLength={60} defaultValue={suggestedName} placeholder="The Clueless" />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium">City</span>
        <input className="field mt-1" name="city" defaultValue="San Diego" maxLength={60} />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn w-full" disabled={busy}>
        {busy ? "Finishing…" : "Finish signup"}
      </button>
    </form>
  );
}
