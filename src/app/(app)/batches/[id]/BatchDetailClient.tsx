"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";

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
  syncSummary: {
    created: number;
    updated: number;
    published: number;
    products: number;
  } | null;
  lastSyncedAt: string | null;
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
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const autoKick = useRef(false);
  const actionInFlight = useRef(false);
  const [pollUntil, setPollUntil] = useState<number>(0);
  const [showDoneFlash, setShowDoneFlash] = useState(false);
  const wasWorking = useRef(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    danger?: boolean;
    run: () => void;
  }>(null);

  const job = initialJob;
  const itemCounts = initialCounts;
  const processingInProgress = ["pending", "processing"].includes(job.status);
  const syncInProgress = job.shopifySyncStatus === "syncing";
  const working =
    processingInProgress ||
    syncInProgress ||
    busy ||
    actionInFlight.current ||
    Boolean(actionLabel);
  const doneCount = itemCounts.completed;
  const totalCount = job.totalItems || 0;
  const pct =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const failCount = itemCounts.failed;
  const barCritical =
    failCount > 0 && doneCount + failCount >= totalCount;

  const syncPct =
    job.shopifySyncStatus === "synced"
      ? 100
      : syncInProgress
        ? Math.min(95, Math.max(pct, 40))
        : job.shopifySyncStatus === "failed"
          ? 0
          : processingInProgress
            ? Math.min(90, pct)
            : job.status === "completed"
              ? 100
              : pct;

  const progressTitle = syncInProgress
    ? "Syncing products to Shopify…"
    : processingInProgress
      ? `Composing mockups… ${doneCount}/${totalCount}`
      : actionLabel || "Updating…";

  const runAction = useCallback(
    (url: string, body?: Record<string, unknown>, label?: string) => {
      if (actionInFlight.current) return;
      actionInFlight.current = true;

      setBusy(true);
      setError("");
      setActionLabel(label || "Updating…");
      setShowDoneFlash(false);
      setPollUntil(Date.now() + 180_000);

      // Make the UI feel responsive immediately; polling + refresh will drive updates.
      setTimeout(() => {
        setBusy(false);
      }, 400);

      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || "Action failed");
            setActionLabel("");
            toast.push(data.error || "Action failed", "error");
            return;
          }
          if (data.message) {
            toast.push(data.message, "success");
          } else if (data.summary) {
            const s = data.summary;
            toast.push(
              `Synced ${s.products} · ${s.created} created · ${s.updated} updated · ${s.published} published`,
              "success",
            );
          }
        })
        .catch(() => {
          setError("Network error");
          setActionLabel("");
        })
        .finally(() => {
          actionInFlight.current = false;
          setBusy(false);
          router.refresh();
        });
    },
    [router, toast],
  );

  // Clear transient "updating" label once server reports idle/finished
  useEffect(() => {
    const idle =
      !processingInProgress &&
      !syncInProgress &&
      ["completed", "failed", "paused"].includes(job.status);

    if (idle && actionLabel) {
      setActionLabel("");
      setPollUntil(0);
    }
  }, [
    processingInProgress,
    syncInProgress,
    job.status,
    job.shopifySyncStatus,
    actionLabel,
  ]);

  // Flash a short "Done" banner when work finishes
  useEffect(() => {
    const nowWorking = processingInProgress || syncInProgress;
    if (nowWorking) {
      wasWorking.current = true;
      return;
    }
    if (wasWorking.current && job.status === "completed") {
      wasWorking.current = false;
      setShowDoneFlash(true);
      setActionLabel("");
      const t = setTimeout(() => setShowDoneFlash(false), 3500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [processingInProgress, syncInProgress, job.status]);

  // Auto-advance processing chunks while job is running
  useEffect(() => {
    if (!processingInProgress) {
      autoKick.current = false;
      return undefined;
    }
    if (busy || actionInFlight.current) return undefined;
    const t = setTimeout(() => {
      void runAction(
        `/api/batches/${job.id}/process`,
        { intent: "process" },
        "Composing mockups…",
      );
      autoKick.current = true;
    }, autoKick.current ? 900 : 300);
    return () => clearTimeout(t);
  }, [
    processingInProgress,
    busy,
    job.processedItems,
    job.status,
    job.id,
    runAction,
  ]);

  // Stop manual polling after a window
  useEffect(() => {
    if (pollUntil <= 0) return undefined;
    const ms = Math.max(0, pollUntil - Date.now());
    const t = setTimeout(() => setPollUntil(0), ms + 100);
    return () => clearTimeout(t);
  }, [pollUntil]);

  // Poll refresh while processing OR syncing OR when an action was just started
  useEffect(() => {
    const enabled = processingInProgress || syncInProgress || pollUntil > 0;
    if (!enabled) return undefined;

    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [processingInProgress, syncInProgress, pollUntil, router]);

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title || ""}
        description={confirm?.description}
        danger={confirm?.danger}
        confirmLabel="Confirm"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const fn = confirm?.run;
          setConfirm(null);
          fn?.();
        }}
      />

      {error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {working ? (
        <div className="rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <span className="font-medium">{progressTitle}</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={syncPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={progressTitle}
            className="w-full h-2 rounded-full bg-border overflow-hidden"
          >
            <div
              className={`h-full bg-accent transition-[width] duration-500 ${
                syncInProgress && !processingInProgress
                  ? "animate-pulse"
                  : ""
              }`}
              style={{ width: `${Math.min(100, Math.max(8, syncPct))}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            {syncInProgress
              ? "Publishing products to Shopify channels…"
              : processingInProgress
                ? `${pct}% mockups · ${itemCounts.pending} pending · ${itemCounts.processing} in progress`
                : "Waiting for server update…"}
          </p>
        </div>
      ) : null}

      {showDoneFlash && !working ? (
        <p className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
          Done — {doneCount}/{totalCount} mockups
          {job.shopifySyncStatus === "synced" ? " · Shopify synced" : ""}
        </p>
      ) : null}

      {job.syncSummary && job.shopifySyncStatus === "synced" ? (
        <div className="rounded-lg border border-border bg-panel px-4 py-3 text-sm space-y-1">
          <p className="font-medium">Last Shopify sync summary</p>
          <p className="text-muted">
            {job.syncSummary.products} products · {job.syncSummary.created}{" "}
            created · {job.syncSummary.updated} updated ·{" "}
            {job.syncSummary.published} published to channels
            {job.lastSyncedAt
              ? ` · ${new Date(job.lastSyncedAt).toLocaleString()}`
              : ""}
          </p>
        </div>
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

        <p className="text-sm text-muted">
          Batch shop: <strong className="text-foreground">{shop}</strong>
        </p>

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
          {processingInProgress
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
            disabled={busy || working}
            onClick={() =>
              runAction(
                `/api/batches/${job.id}/process`,
                { intent: "process" },
                "Composing mockups…",
              )
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
                runAction(
                  `/api/batches/${job.id}/process`,
                  { intent: "pause" },
                  "Pausing…",
                )
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
                runAction(
                  `/api/batches/${job.id}/process`,
                  { intent: "resume" },
                  "Resuming…",
                )
              }
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background disabled:opacity-60"
            >
              Resume
            </button>
          )}
          {job.status === "completed" ? (
            <button
              type="button"
              disabled={busy || syncInProgress}
              onClick={() =>
                runAction(
                  `/api/batches/${job.id}/sync`,
                  undefined,
                  "Syncing to Shopify…",
                )
              }
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background disabled:opacity-60"
            >
              Sync Shopify now
            </button>
          ) : null}
          {["completed", "failed", "paused"].includes(job.status) ? (
            <>
              <button
                type="button"
                disabled={busy || failCount === 0 || working}
                onClick={() =>
                  setConfirm({
                    title: "Recompose failed items?",
                    description:
                      "Failed mockups will be reset and composed again. Existing Shopify products are not deleted.",
                    danger: true,
                    run: () =>
                      runAction(
                        `/api/batches/${job.id}/recompose`,
                        { scope: "failed" },
                        "Recomposing failed items…",
                      ),
                  })
                }
                className="rounded-lg border border-danger/40 text-danger px-3 py-1.5 text-sm font-medium hover:bg-danger/5 disabled:opacity-60"
              >
                Recompose failed
              </button>
              <button
                type="button"
                disabled={busy || working}
                onClick={() =>
                  setConfirm({
                    title: "Recompose all items?",
                    description:
                      "All mockups in this batch will be regenerated. This can take several minutes and may use Lambda/S3 quota.",
                    danger: true,
                    run: () =>
                      runAction(
                        `/api/batches/${job.id}/recompose`,
                        { scope: "all" },
                        "Recomposing all items…",
                      ),
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
