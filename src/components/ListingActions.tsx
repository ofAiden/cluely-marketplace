"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";

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
    <div className="flex gap-2 text-xs items-center">
      <Link href={`/listing/${id}/edit`} className="btn btn-secondary !py-1 !px-2">
        Edit
      </Link>
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
      <ConfirmButton
        onConfirm={() => setStatus("removed")}
        disabled={busy}
        title="Remove this listing?"
        message="It disappears from the marketplace and buyers can't find it any more. Your existing conversations stay, but nobody new can message you about it."
      >
        Remove
      </ConfirmButton>
    </div>
  );
}
