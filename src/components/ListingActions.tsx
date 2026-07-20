"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ListingActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: string) {
    setBusy(true);
    await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2 text-xs">
      {status === "active" && (
        <button className="btn btn-secondary !py-1 !px-2" disabled={busy} onClick={() => setStatus("sold")}>
          Mark sold
        </button>
      )}
      {status === "sold" && (
        <button className="btn btn-secondary !py-1 !px-2" disabled={busy} onClick={() => setStatus("active")}>
          Relist
        </button>
      )}
      <button className="btn btn-secondary !py-1 !px-2" disabled={busy} onClick={() => setStatus("removed")}>
        Remove
      </button>
    </div>
  );
}
