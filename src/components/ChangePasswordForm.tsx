"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const f = new FormData(e.currentTarget);
    const newPassword = String(f.get("newPassword") ?? "");
    if (newPassword !== String(f.get("confirm") ?? "")) {
      setMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: f.get("currentPassword"),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, text: data.error ?? "Could not change password." });
      else {
        setMsg({ ok: true, text: "Password updated." });
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 900);
      }
    } catch {
      setMsg({ ok: false, text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium">Current password</span>
        <input className="field mt-1" name="currentPassword" type="password" required maxLength={128} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">New password</span>
        <input className="field mt-1" name="newPassword" type="password" required minLength={10} maxLength={128} />
        <span className="text-xs text-stone-500">At least 10 characters with a letter and a number.</span>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Confirm new password</span>
        <input className="field mt-1" name="confirm" type="password" required minLength={10} maxLength={128} />
      </label>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
      <button className="btn w-full" disabled={busy}>
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
