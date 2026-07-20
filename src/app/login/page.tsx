"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GoogleButton from "@/components/GoogleButton";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Sign-in failed.");
      else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto card p-6 mt-6">
      <h1 className="text-xl font-bold mb-4">Sign in</h1>
      <GoogleButton label="Sign in with Google" />
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Team email</span>
          <input className="field mt-1" name="email" type="email" required maxLength={254} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input className="field mt-1" name="password" type="password" required maxLength={128} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-sm text-stone-500 mt-4">
        New here?{" "}
        <Link href="/register" className="link">
          Register your team
        </Link>
      </p>
    </div>
  );
}
