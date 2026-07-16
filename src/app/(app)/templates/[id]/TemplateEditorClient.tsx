"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TemplateCropEditor,
  type TemplateForEditor,
} from "@/components/TemplateCropEditor";

export type PricingConfigOption = {
  id: string;
  name: string;
};

export type TemplateEditorData = TemplateForEditor & {
  description: string | null;
  productType: string;
  category: string;
  basePrice: number;
  pricingConfigId: string | null;
  pricingConfig: { id: string; name: string } | null;
};

type Props = {
  template: TemplateEditorData;
  pricingConfigs: PricingConfigOption[];
};

export default function TemplateEditorClient({
  template,
  pricingConfigs,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || "");
  const [basePrice, setBasePrice] = useState(String(template.basePrice));
  const [pricingConfigId, setPricingConfigId] = useState(
    template.pricingConfigId || "",
  );
  const [infoMsg, setInfoMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(template.name);
    setDescription(template.description || "");
    setBasePrice(String(template.basePrice));
    setPricingConfigId(template.pricingConfigId || "");
  }, [
    template.name,
    template.description,
    template.basePrice,
    template.pricingConfigId,
  ]);

  async function saveInfo() {
    setBusy(true);
    setInfoMsg("");
    try {
      const fd = new FormData();
      fd.set("intent", "update_template");
      fd.set("name", name);
      fd.set("description", description);
      fd.set("basePrice", basePrice);
      fd.set("pricingConfigId", pricingConfigId);
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.message) setInfoMsg(data.message);
      if (data.error) setInfoMsg(`Error: ${data.error}`);
      if (res.ok) router.refresh();
    } catch {
      setInfoMsg("Error: Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <Link
          href="/templates"
          className="text-sm font-medium text-accent hover:underline"
        >
          ← Back to templates
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {template.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {template.productType} · {template.category} · base $
          {template.basePrice}
          {template.pricingConfig
            ? ` · pricing: ${template.pricingConfig.name}`
            : " · no pricing config linked"}{" "}
          — each garment type has its own base price; size and color adjustments come
          from the pricing config linked to this template.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-panel p-4 sm:p-6">
        {infoMsg ? (
          <div
            className={`mb-3 rounded-lg px-3 py-2 text-sm ${
              infoMsg.startsWith("Error")
                ? "bg-danger/5 text-danger"
                : "bg-accent/5 text-accent"
            }`}
          >
            {infoMsg}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-xs">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block min-w-[180px] rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block min-w-[200px] rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            Base price (this garment type)
            <input
              type="number"
              step="0.01"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="mt-1 block w-[120px] rounded-lg border border-border bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            Pricing config (size / color)
            <select
              value={pricingConfigId}
              onChange={(e) => setPricingConfigId(e.target.value)}
              className="mt-1 block min-w-[200px] rounded-lg border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {pricingConfigs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveInfo()}
            className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save details"}
          </button>
        </div>

        <TemplateCropEditor
          template={template}
          key={`${template.id}-${template.variants.length}`}
        />
      </section>
    </div>
  );
}
