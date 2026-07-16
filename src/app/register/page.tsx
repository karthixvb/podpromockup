"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }
      router.push("/stores");
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
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Create account</h1>
        <p className="text-muted text-sm mb-6">POD Pro multi-store admin</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 bg-white"
            />
          </label>
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
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
