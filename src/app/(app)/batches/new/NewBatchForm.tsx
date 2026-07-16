"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseDesignsJson } from "@/lib/pod";

type TemplateSetOption = {
  id: string;
  name: string;
  memberCount: number;
  productTypes: string[];
};

type PricingOption = {
  id: string;
  name: string;
};

type Props = {
  sets: TemplateSetOption[];
  pricing: PricingOption[];
  defaultCreateAsDraft: boolean;
};

export default function NewBatchForm({
  sets,
  pricing,
  defaultCreateAsDraft,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [templateSetId, setTemplateSetId] = useState("");
  const [pricingConfigId, setPricingConfigId] = useState("");
  const [autoPublish, setAutoPublish] = useState(true);
  const [createAsDraft, setCreateAsDraft] = useState(defaultCreateAsDraft);
  const [designsJson, setDesignsJson] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [rejected, setRejected] = useState<
    { index: number; sku: string | null }[]
  >([]);
  const [busy, setBusy] = useState(false);

  const selectedSet = sets.find((s) => s.id === templateSetId) || null;

  const preview = useMemo(() => {
    if (!designsJson.trim()) return null;
    return parseDesignsJson(designsJson);
  }, [designsJson]);

  const estimatedItems = useMemo(() => {
    if (!preview?.ok || !selectedSet) return null;
    const typeCount = selectedSet.memberCount || 1;
    return preview.designs.length * typeCount * 8;
  }, [preview, selectedSet]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setRejected([]);
    try {
      const text = await file.text();
      setDesignsJson(text);
      setFileName(file.name);
      if (!name.trim()) {
        setName(file.name.replace(/\.json$/i, "").replace(/[_-]+/g, " "));
      }
    } catch {
      setError("Could not read JSON file");
    }
  }

  async function start() {
    setError("");
    setRejected([]);
    if (!name.trim() || !templateSetId || !designsJson.trim()) {
      setError(
        "Batch name, template set, and designs JSON are required (upload or paste).",
      );
      return;
    }
    if (preview && !preview.ok) {
      setError(preview.error || "Invalid JSON");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          templateSetId,
          pricingConfigId: pricingConfigId || null,
          autoPublishShopify: autoPublish,
          createAsDraft,
          designsJson,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create batch");
        if (Array.isArray(data.rejected)) {
          setRejected(data.rejected.slice(0, 10));
        }
        return;
      }
      router.push(`/batches/${data.id}`);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-panel border border-border rounded-lg p-6 space-y-4">
      {(error || rejected.length > 0) && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
          {rejected.length > 0 ? (
            <div className="mt-1.5 opacity-85">
              Rejected samples:{" "}
              {rejected
                .map((r) => `#${r.index} ${r.sku || ""}`)
                .join(", ")}
            </div>
          ) : null}
        </div>
      )}

      <label className="block text-sm">
        <span className="text-xs text-muted">Batch name</span>
        <input
          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wave drop #1"
        />
      </label>

      <label className="block text-sm">
        <span className="text-xs text-muted">Template set</span>
        <select
          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2"
          value={templateSetId}
          onChange={(e) => setTemplateSetId(e.target.value)}
        >
          <option value="">— Select set —</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.productTypes.join(", ") || "empty"})
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-xs text-muted">Pricing fallback (optional)</span>
        <select
          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2"
          value={pricingConfigId}
          onChange={(e) => setPricingConfigId(e.target.value)}
        >
          <option value="">Use pricing assigned to each template</option>
          {pricing.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoPublish}
          onChange={(e) => setAutoPublish(e.target.checked)}
        />
        Auto-sync to Shopify when mockups are ready (updates existing products —
        no duplicates)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={createAsDraft}
          onChange={(e) => setCreateAsDraft(e.target.checked)}
        />
        Create products as <strong>Draft</strong> for review before publishing
      </label>

      <div className="rounded-lg border border-dashed border-border bg-background p-4 space-y-3">
        <p className="text-sm font-semibold">
          Designs JSON — upload a file or paste
        </p>
        <label className="block text-sm">
          <span className="text-xs text-muted">
            Upload file <code>.json</code>
          </span>
          <input
            type="file"
            accept=".json,application/json"
            onChange={onPickFile}
            className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
          />
        </label>
        {fileName ? (
          <p className="text-xs text-muted">
            File: <strong>{fileName}</strong>
          </p>
        ) : null}
        <label className="block text-sm">
          <span className="text-xs text-muted">Or paste JSON</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm"
            rows={12}
            value={designsJson}
            onChange={(e) => {
              setDesignsJson(e.target.value);
              setFileName("");
            }}
            placeholder={`[\n  {\n    "sku": "WAVE-001",\n    "title": "Great Wave",\n    "description": "...",\n    "tags": ["wave"],\n    "light_image": "https://...",\n    "dark_image": "https://..."\n  }\n]`}
          />
        </label>
      </div>

      {preview ? (
        <div
          className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
            preview.ok
              ? "bg-accent/5 text-foreground"
              : "bg-danger/5 text-danger"
          }`}
        >
          {preview.ok ? (
            <>
              <p>
                <strong>{preview.designs.length}</strong> / {preview.totalRaw}{" "}
                valid designs
                {preview.rejected?.length
                  ? ` · ${preview.rejected.length} skipped`
                  : ""}
                {preview.duplicateSkus?.length
                  ? ` · ${preview.duplicateSkus.length} duplicate SKUs (first kept)`
                  : ""}
              </p>
              {estimatedItems != null ? (
                <p className="mt-1 text-muted">
                  Estimated mockup jobs ≈ {estimatedItems} (design × type ×
                  color/scene)
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted">
                Sample SKUs:{" "}
                {preview.designs
                  .slice(0, 5)
                  .map((d) => d.sku)
                  .join(", ")}
                {preview.designs.length > 5 ? "…" : ""}
              </p>
            </>
          ) : (
            <p>{preview.error}</p>
          )}
        </div>
      ) : null}

      <p className="text-sm text-muted">
        Format: an array of designs, or{" "}
        <code>{`{ "designs": [...] }`}</code>. Each item needs a{" "}
        <code>sku</code> plus <code>light_image</code>/<code>dark_image</code>{" "}
        (or <code>design_url</code>). Syncing to Shopify{" "}
        <strong>updates</strong> existing products with the same design and
        type.
      </p>

      <button
        type="button"
        disabled={busy || Boolean(preview && !preview.ok)}
        onClick={start}
        className="rounded-lg bg-accent hover:bg-accent-hover text-white px-4 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {busy ? "Creating…" : "Start batch"}
      </button>
    </section>
  );
}
