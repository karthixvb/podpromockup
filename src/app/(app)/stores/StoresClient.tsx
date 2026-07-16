"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ToastProvider";

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
  const toast = useToast();
  const [shopInput, setShopInput] = useState("");
  const [busyShop, setBusyShop] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pendingDisconnect, setPendingDisconnect] = useState<string | null>(
    null,
  );

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
        toast.push(data.error || "Could not switch store", "error");
        return;
      }
      toast.push(`Switched to ${shop}`, "success");
      router.refresh();
    } catch {
      setMessage("Network error");
      toast.push("Network error", "error");
    } finally {
      setBusyShop(null);
    }
  }

  async function confirmDisconnect() {
    if (!pendingDisconnect) return;
    const shop = pendingDisconnect;
    setPendingDisconnect(null);
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
        toast.push(data.error || "Could not disconnect store", "error");
        return;
      }
      toast.push(`Disconnected ${shop}`, "success");
      router.refresh();
    } catch {
      setMessage("Network error");
      toast.push("Network error", "error");
    } finally {
      setBusyShop(null);
    }
  }

  return (
    <div className="space-y-8">
      <ConfirmDialog
        open={Boolean(pendingDisconnect)}
        title="Disconnect store?"
        description={`Remove OAuth access for ${pendingDisconnect}. Existing POD data for this shop stays in the database but sync will stop until you reconnect.`}
        danger
        confirmLabel="Disconnect"
        busy={busyShop === pendingDisconnect}
        onCancel={() => setPendingDisconnect(null)}
        onConfirm={() => void confirmDisconnect()}
      />

      {connected ? (
        <p className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          Store connected successfully. Continue setup from the dashboard
          checklist.
        </p>
      ) : null}
      {error === "oauth" ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Shopify connection failed. Check App URL, Redirect URL, and SCOPES,
          then try again.
        </p>
      ) : null}
      {message ? <p className="text-sm text-danger">{message}</p> : null}

      <section className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Connect a store</h2>
        <p className="mt-1 text-sm text-muted">
          Enter your Shopify domain to authorize POD Pro. After changing app
          scopes, reconnect so publications publish correctly.
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
          <div className="mt-4">
            <EmptyState
              title="No stores connected"
              description="Connect your first Shopify shop to start templates, batches, and sync."
              actionHref="#connect"
              actionLabel="Connect above"
            />
          </div>
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
                    onClick={() => setPendingDisconnect(store.shop)}
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
