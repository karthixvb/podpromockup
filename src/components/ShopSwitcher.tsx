"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ShopOption = {
  shop: string;
};

export default function ShopSwitcher({
  shops,
  activeShop,
}: {
  shops: ShopOption[];
  activeShop: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(activeShop ?? "");

  useEffect(() => {
    setValue(activeShop ?? "");
  }, [activeShop]);

  if (shops.length === 0) {
    return <p className="text-xs text-muted">No stores connected</p>;
  }

  async function onChange(shop: string) {
    if (!shop || shop === activeShop) return;
    setValue(shop);
    setBusy(true);
    try {
      const res = await fetch("/api/shops/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop }),
      });
      if (!res.ok) {
        setValue(activeShop ?? "");
        return;
      }
      router.refresh();
    } catch {
      setValue(activeShop ?? "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">Active store</span>
      <select
        value={value}
        disabled={busy || shops.length < 2}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm disabled:opacity-60"
      >
        {shops.map((s) => (
          <option key={s.shop} value={s.shop}>
            {s.shop}
          </option>
        ))}
      </select>
    </label>
  );
}
