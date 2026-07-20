"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: f.get("email") }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, text: data.error ?? "Something went wrong." });
      else setMsg({ ok: true, text: data.message ?? "Check your email for a reset link." });
    } catch {
      setMsg({ ok: false, text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto card p-6 mt-6">
      <h1 className="text-xl font-bold">Reset your password</h1>
      <p className="text-sm text-stone-500 mt-1 mb-4">
        Enter your team email and we&apos;ll send a link to set a new password.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Team email</span>
          <input className="field mt-1" name="email" type="email" required maxLength={254} />
        </label>
        {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="text-sm text-stone-500 mt-4">
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
