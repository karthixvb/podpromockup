"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={busy}
      className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Log out"}
    </button>
  );
}
