"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BanButton({ userId, banned }: { userId: string; banned: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!banned && !confirm("Ban this team? They'll be signed out and blocked from the site.")) return;
    setBusy(true);
    await fetch("/api/admin/ban", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, banned: !banned }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      className={`btn ${banned ? "btn-secondary" : ""} !py-1 !px-3 text-xs`}
      style={banned ? undefined : { background: "#b91c1c", borderColor: "#991b1b" }}
      disabled={busy}
      onClick={toggle}
    >
      {banned ? "Unban" : "Ban"}
    </button>
  );
}
