"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";

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
  owner = false,
}: {
  id: string;
  label?: string;
  redirectTo?: string;
  /** Changes the confirmation wording between "your listing" and moderation. */
  owner?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function takeDown() {
    setError("");
    const res = await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "removed" }),
    });
    if (!res.ok) {
      setError("Could not remove the listing. Please try again.");
      return;
    }
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }

  return (
    <div className="text-right">
      <ConfirmButton
        onConfirm={takeDown}
        className="btn !py-1 !px-3 text-xs"
        triggerStyle={{ background: "#b91c1c", borderColor: "#991b1b" }}
        title={owner ? "Remove your listing?" : "Take this listing down?"}
        message={
          owner
            ? "It disappears from the marketplace and buyers can't find it any more. Your existing conversations stay, but nobody new can message you about it."
            : "This removes another team's listing from the marketplace. They keep their conversations, but the part will no longer be browsable."
        }
        confirmLabel={owner ? "Yes, remove it" : "Yes, take it down"}
      >
        {label}
      </ConfirmButton>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
