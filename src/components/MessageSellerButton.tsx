"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MessageSellerButton({
  listingId,
  signedIn,
}: {
  listingId: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!signedIn) {
    return (
      <button className="btn" onClick={() => router.push("/login")}>
        Sign in to message
      </button>
    );
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        Message seller
      </button>
    );
  }

  async function sendMessage() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId, body: text }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not send.");
      else router.push(`/messages/${data.conversationId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full sm:w-80">
      <textarea
        className="field min-h-24"
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Hi! Is this still available? I'm interested…"
        maxLength={2000}
      />
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button className="btn flex-1" disabled={busy || !body.trim()} onClick={sendMessage}>
          {busy ? "Sending…" : "Send message"}
        </button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
