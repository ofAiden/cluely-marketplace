"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TakeDownButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function takeDown() {
    if (!confirm("Take down this listing? It will be removed from the marketplace.")) return;
    setBusy(true);
    await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "removed" }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      className="btn !py-1 !px-3 text-xs"
      style={{ background: "#b91c1c", borderColor: "#991b1b" }}
      disabled={busy}
      onClick={takeDown}
    >
      Take down
    </button>
  );
}
