"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export type StoreRow = {
  shop: string;
  scope: string | null;
  isActive: boolean;
};

type Props = {
  stores: StoreRow[];
  connected?: boolean;
  error?: string | null;
};

export default function StoresClient({ stores, connected, error }: Props) {
  const router = useRouter();
  const [shopInput, setShopInput] = useState("");
  const [busyShop, setBusyShop] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function onConnect(e: FormEvent) {
    e.preventDefault();
    const raw = shopInput.trim();
    if (!raw) return;
    window.location.href = `/api/shopify/auth/begin?shop=${encodeURIComponent(raw)}`;
  }

  async function switchStore(shop: string) {
    setBusyShop(shop);
    setMessage("");
    try {
      const res = await fetch("/api/shops/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not switch store");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Network error");
    } finally {
      setBusyShop(null);
    }
  }

  async function disconnectStore(shop: string) {
    if (!confirm(`Disconnect ${shop}?`)) return;
    setBusyShop(shop);
    setMessage("");
    try {
      const res = await fetch("/api/shops/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not disconnect store");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Network error");
    } finally {
      setBusyShop(null);
    }
  }

  return (
    <div className="space-y-8">
      {connected ? (
        <p className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          Store connected successfully.
        </p>
      ) : null}
      {error === "oauth" ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Shopify connection failed. Please try again.
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-danger">{message}</p>
      ) : null}

      <section className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Connect a store</h2>
        <p className="mt-1 text-sm text-muted">
          Enter your Shopify domain to authorize POD Pro.
        </p>
        <form onSubmit={onConnect} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={shopInput}
            onChange={(e) => setShopInput(e.target.value)}
            placeholder="your-store.myshopify.com"
            className="flex-1 rounded-lg border border-border bg-white px-3 py-2"
            required
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white hover:bg-accent-hover"
          >
            Connect
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Connected stores</h2>
        {stores.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No stores connected yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {stores.map((store) => (
              <li
                key={store.shop}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{store.shop}</span>
                    {store.isActive ? (
                      <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        Active
                      </span>
                    ) : null}
                  </div>
                  {store.scope ? (
                    <p className="mt-1 text-xs text-muted break-all">
                      Scopes: {store.scope}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {!store.isActive ? (
                    <button
                      type="button"
                      disabled={busyShop === store.shop}
                      onClick={() => switchStore(store.shop)}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background disabled:opacity-60"
                    >
                      Switch
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyShop === store.shop}
                    onClick={() => disconnectStore(store.shop)}
                    className="rounded-lg border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/5 disabled:opacity-60"
                  >
                    Disconnect
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
