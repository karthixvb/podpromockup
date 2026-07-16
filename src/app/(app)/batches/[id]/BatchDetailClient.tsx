"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type JobView = {
  id: string;
  name: string;
  status: string;
  shopifySyncStatus: string;
  autoPublishShopify: boolean;
  createAsDraft: boolean;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  errorMessage: string | null;
  templateSetName: string | null;
};

type ItemCounts = {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
};

type ProductLink = {
  id: string;
  productTypeKey: string;
  designSku: string;
  shopifyProductGid: string;
  shopifyHandle: string | null;
};

type ItemRow = {
  id: string;
  status: string;
  sku: string;
  productType: string | null;
  variantName: string | null;
  sceneName: string | null;
  resultUrl: string | null;
  errorMessage: string | null;
};

type Props = {
  shop: string;
  job: JobView;
  itemCounts: ItemCounts;
  productLinks: ProductLink[];
  items: ItemRow[];
};

function statusClass(status: string) {
  switch (status) {
    case "completed":
    case "synced":
      return "bg-accent/10 text-accent";
    case "processing":
    case "pending":
    case "syncing":
      return "bg-warning/10 text-warning";
    case "failed":
      return "bg-danger/10 text-danger";
    default:
      return "bg-background text-muted";
  }
}

export default function BatchDetailClient({
  shop,
  job: initialJob,
  itemCounts: initialCounts,
  productLinks,
  items,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const autoKick = useRef(false);

  const job = initialJob;
  const itemCounts = initialCounts;
  const inProgress = ["pending", "processing"].includes(job.status);
  const doneCount = itemCounts.completed;
  const totalCount = job.totalItems || 0;
  const pct =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const failCount = itemCounts.failed;
  const barCritical =
    failCount > 0 && doneCount + failCount >= totalCount;

  const runAction = useCallback(
    async (url: string, body?: Record<string, unknown>) => {
      setBusy(true);
      setMessage("");
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(data.error || "Action failed");
          return;
        }
        router.refresh();
      } catch {
        setMessage("Network error");
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  // Auto-advance processing chunks while job is running
  useEffect(() => {
    if (!inProgress) {
      autoKick.current = false;
      return undefined;
    }
    if (busy) return undefined;
    const t = setTimeout(() => {
      void runAction(`/api/batches/${job.id}/process`, { intent: "process" });
      autoKick.current = true;
    }, autoKick.current ? 800 : 200);
    return () => clearTimeout(t);
  }, [inProgress, busy, job.processedItems, job.status, job.id, runAction]);

  // Poll refresh while processing
  useEffect(() => {
    if (!inProgress) return undefined;
    const t = setInterval(() => {
      router.refresh();
    }, 2000);
    return () => clearInterval(t);
  }, [inProgress, router]);

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {message}
        </p>
      ) : null}

      <section className="bg-panel border border-border rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded ${statusClass(job.status)}`}
          >
            {job.status}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${statusClass(job.shopifySyncStatus)}`}
          >
            shopify: {job.shopifySyncStatus}
          </span>
          <span className="text-sm text-muted">
            {doneCount}/{totalCount} complete ({pct}%)
            {itemCounts.processing > 0
              ? ` · processing ${itemCounts.processing}`
              : ""}
            {itemCounts.pending > 0
              ? ` · pending ${itemCounts.pending}`
              : ""}
            {failCount > 0 ? ` · failed ${failCount}` : ""}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label={`Mockup progress ${doneCount} of ${totalCount}`}
          className="w-full max-w-xl h-3 rounded-full bg-border overflow-hidden"
        >
          <div
            className={`h-full transition-[width] duration-300 ${
              barCritical ? "bg-danger" : "bg-accent"
            }`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        <p className="text-sm">
          Mockup compose:{" "}
          <strong>
            {doneCount}/{totalCount}
          </strong>{" "}
          complete
          {inProgress
            ? "…"
            : doneCount >= totalCount && totalCount > 0
              ? " ✓"
              : ""}
        </p>

        {job.errorMessage ? (
          <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {job.errorMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              runAction(`/api/batches/${job.id}/process`, {
                intent: "process",
              })
            }
            className="rounded-lg bg-accent hover:bg-accent-hover text-white px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            Process next chunk
          </button>
          {job.status !== "paused" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                runAction(`/api/batches/${job.id}/process`, {
                  intent: "pause",
                })
              }
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background disabled:opacity-60"
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                runAction(`/api/batches/${job.id}/process`, {
                  intent: "resume",
                })
              }
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background disabled:opacity-60"
            >
              Resume
            </button>
          )}
          {job.status === "completed" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(`/api/batches/${job.id}/sync`)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background disabled:opacity-60"
            >
              Sync Shopify now
            </button>
          ) : null}
          {["completed", "failed", "paused"].includes(job.status) ? (
            <>
              <button
                type="button"
                disabled={busy || failCount === 0}
                onClick={() =>
                  runAction(`/api/batches/${job.id}/recompose`, {
                    scope: "failed",
                  })
                }
                className="rounded-lg border border-danger/40 text-danger px-3 py-1.5 text-sm font-medium hover:bg-danger/5 disabled:opacity-60"
              >
                Recompose failed
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(`/api/batches/${job.id}/recompose`, {
                    scope: "all",
                  })
                }
                className="rounded-lg border border-danger/40 text-danger px-3 py-1.5 text-sm font-medium hover:bg-danger/5 disabled:opacity-60"
              >
                Recompose all
              </button>
            </>
          ) : null}
        </div>

        <p className="text-sm text-muted">
          Set: {job.templateSetName || "—"} · Auto-publish:{" "}
          {job.autoPublishShopify ? "yes" : "no"}
          {job.createAsDraft ? " · Draft products" : ""} · Sync updates
          existing products for the same design and type
        </p>
      </section>

      {productLinks.length > 0 ? (
        <section className="bg-panel border border-border rounded-lg p-5 space-y-3">
          <h2 className="text-base font-semibold">Shopify products</h2>
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {productLinks.map((link) => {
              const numericId = String(link.shopifyProductGid || "")
                .split("/")
                .pop();
              const adminUrl = numericId
                ? `https://${shop}/admin/products/${numericId}`
                : null;
              return (
                <li
                  key={link.id}
                  className="flex flex-wrap items-center gap-2 px-3 py-3 text-sm"
                >
                  <span className="text-xs px-2 py-0.5 rounded bg-background text-muted">
                    {link.productTypeKey}
                  </span>
                  <span>{link.designSku}</span>
                  <span className="text-muted">{link.shopifyHandle}</span>
                  {adminUrl ? (
                    <a
                      href={adminUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent font-medium"
                    >
                      Open in Admin
                    </a>
                  ) : null}
                  {link.shopifyHandle ? (
                    <a
                      href={`https://${shop}/products/${link.shopifyHandle}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent font-medium"
                    >
                      Storefront
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="bg-panel border border-border rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold">Items (first 100)</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted">No items.</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"
              >
                <span
                  className={`text-xs px-2 py-0.5 rounded ${statusClass(item.status)}`}
                >
                  {item.status}
                </span>
                <span>{item.sku}</span>
                <span className="text-muted">{item.productType}</span>
                <span className="text-muted">{item.variantName}</span>
                <span className="text-muted">{item.sceneName}</span>
                {item.resultUrl && !item.resultUrl.startsWith("file:") ? (
                  <a
                    href={item.resultUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent font-medium"
                  >
                    result
                  </a>
                ) : null}
                {item.errorMessage ? (
                  <span className="text-danger text-xs">
                    {item.errorMessage}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
