"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
          teamNumber: f.get("teamNumber"),
          teamName: f.get("teamName"),
          city: f.get("city") || "San Diego",
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Registration failed.");
      else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto card p-6 mt-6">
      <h1 className="text-xl font-bold">Register your team</h1>
      <p className="text-sm text-stone-500 mt-1 mb-4">
        One account per FTC team. You&apos;ll use it to post and buy parts.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Team number</span>
            <input className="field mt-1" name="teamNumber" type="number" min={1} max={99999} required placeholder="11212" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Team name</span>
            <input className="field mt-1" name="teamName" required maxLength={60} placeholder="The Clueless" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Team email</span>
          <input className="field mt-1" name="email" type="email" required maxLength={254} placeholder="team@example.com" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input className="field mt-1" name="password" type="password" required minLength={10} maxLength={128} />
          <span className="text-xs text-stone-500">At least 10 characters with a letter and a number.</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">City</span>
          <input className="field mt-1" name="city" defaultValue="San Diego" maxLength={60} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create team account"}
        </button>
      </form>
      <p className="text-sm text-stone-500 mt-4">
        Already registered?{" "}
        <Link href="/login" className="link">
          Sign in
        </Link>
      </p>
    </div>
  );
}
