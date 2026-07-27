"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Removes a listing from the marketplace (status -> "removed").
 * The API authorizes this for the listing's owner OR any admin, so this button
 * is safe to render for either. Pass `redirectTo` when used on a page that would
 * 404 after removal (e.g. the listing page itself); otherwise it just refreshes.
 */
export default function TakeDownButton({
  id,
  label = "Take down",
  redirectTo,
}: {
  id: string;
  label?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function takeDown() {
    if (!confirm("Remove this listing from the marketplace? Buyers will no longer see it.")) return;
    setBusy(true);
    const res = await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "removed" }),
    });
    setBusy(false);
    if (!res.ok) {
      alert("Could not remove the listing. Please try again.");
      return;
    }
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }

  return (
    <button
      className="btn !py-1 !px-3 text-xs"
      style={{ background: "#b91c1c", borderColor: "#991b1b" }}
      disabled={busy}
      onClick={takeDown}
    >
      {busy ? "Removing…" : label}
    </button>
  );
}
