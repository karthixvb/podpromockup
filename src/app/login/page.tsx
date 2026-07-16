"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-panel border border-border rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">POD Pro</h1>
        <p className="text-muted text-sm mb-6">Sign in to manage your stores</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 bg-white"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 bg-white"
            />
          </label>
          {error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent hover:bg-accent-hover text-white py-2.5 font-medium disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted">
          No account?{" "}
          <Link href="/register" className="text-accent font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
