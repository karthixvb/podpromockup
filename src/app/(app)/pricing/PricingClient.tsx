"use client";

import { useState, useTransition } from "react";
import { DEFAULT_SIZES } from "@/lib/pod";
import { deletePricingConfig, savePricingConfig } from "./actions";

export type PricingConfigView = {
  id: string;
  name: string;
  basePrice: number;
  sizeAdjustments: { size: string; adjustment: number }[];
  colorAdjustments: { color: string; adjustment: number }[];
};

type SizeAdj = { size: string; adjustment: number | string };
type ColorAdj = { color: string; adjustment: number | string };

type FormState = {
  id: string;
  name: string;
  basePrice: string;
  sizeAdjs: SizeAdj[];
  colorAdjs: ColorAdj[];
};

function emptyForm(): FormState {
  return {
    id: "",
    name: "",
    basePrice: "19.99",
    sizeAdjs: DEFAULT_SIZES.map((size) => ({ size, adjustment: 0 })),
    colorAdjs: [],
  };
}

type Props = {
  configs: PricingConfigView[];
};

export default function PricingClient({ configs }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setForm(emptyForm());
    setEditing(true);
    setMsg("");
  }

  function openEdit(c: PricingConfigView) {
    setForm({
      id: c.id,
      name: c.name,
      basePrice: String(c.basePrice),
      sizeAdjs:
        c.sizeAdjustments.length > 0
          ? c.sizeAdjustments.map((s) => ({
              size: s.size,
              adjustment: s.adjustment ?? 0,
            }))
          : DEFAULT_SIZES.map((size) => ({ size, adjustment: 0 })),
      colorAdjs: c.colorAdjustments.map((x) => ({
        color: x.color || "",
        adjustment: x.adjustment ?? 0,
      })),
    });
    setEditing(true);
    setMsg("");
  }

  function save() {
    const fd = new FormData();
    if (form.id) fd.set("id", form.id);
    fd.set("name", form.name);
    fd.set("basePrice", form.basePrice);
    fd.set("sizeAdjustments", JSON.stringify(form.sizeAdjs));
    fd.set("colorAdjustments", JSON.stringify(form.colorAdjs));

    startTransition(async () => {
      const result = await savePricingConfig(fd);
      if (result.error) {
        setMsg(`Error: ${result.error}`);
        return;
      }
      setMsg(result.message || "Saved");
      setEditing(false);
      setForm(emptyForm());
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this pricing config?")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const result = await deletePricingConfig(fd);
      if (result.error) {
        setMsg(`Error: ${result.error}`);
        return;
      }
      setMsg(result.message || "Deleted");
    });
  }

  function previewPrice(size: string, color: string) {
    const base = Number(form.basePrice) || 0;
    const sa = form.sizeAdjs.find((s) => s.size === size);
    const ca = form.colorAdjs.find((c) => c.color === color);
    return (
      base +
      (Number(sa?.adjustment) || 0) +
      (Number(ca?.adjustment) || 0)
    ).toFixed(2);
  }

  const fieldClass =
    "rounded-lg border border-border px-3 py-2 bg-white text-foreground";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pricing</h1>
          <p className="text-sm text-muted mt-1">
            Size and color adjustments linked to templates
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-accent hover:bg-accent-hover text-white px-4 py-2 text-sm font-medium"
        >
          + Create pricing config
        </button>
      </div>

      <section className="bg-panel border border-border rounded-lg p-4">
        <p className="text-sm text-muted">
          Shopify price = <strong>base price on the template</strong> (T-Shirt
          and Hoodie can differ) + size and color adjustments from the{" "}
          <strong>pricing config linked to each template</strong>. In a set,
          each garment type should have its own base price (and optionally its
          own pricing config).
        </p>
      </section>

      {msg ? (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            msg.startsWith("Error")
              ? "border border-danger/30 bg-danger/5 text-danger"
              : "border border-accent/30 bg-accent/5 text-accent"
          }`}
        >
          {msg}
        </p>
      ) : null}

      {editing ? (
        <section className="bg-panel border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-base font-semibold">
            {form.id ? "Edit pricing config" : "New pricing config"}
          </h2>

          <div className="grid gap-4 max-w-xl">
            <label className="block">
              <span className="text-sm font-medium">Name</span>
              <input
                className={`mt-1 ${fieldClass} w-full`}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Gildan 5000 Pricing"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Base price ($)</span>
              <input
                type="number"
                step="0.01"
                className={`mt-1 ${fieldClass} w-full`}
                value={form.basePrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, basePrice: e.target.value }))
                }
              />
            </label>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Size adjustments</p>
              <div className="flex gap-2 text-xs font-medium text-muted px-1 max-w-md">
                <span className="flex-1 min-w-[5rem]">Size</span>
                <span className="w-28 shrink-0">Adjustment ($)</span>
                <span className="w-8 shrink-0" aria-hidden />
              </div>
              {form.sizeAdjs.map((sa, i) => (
                <div key={i} className="flex items-center gap-2 max-w-md">
                  <input
                    placeholder="S, M, 2XL…"
                    value={sa.size}
                    onChange={(e) => {
                      const arr = [...form.sizeAdjs];
                      arr[i] = { ...arr[i], size: e.target.value };
                      setForm((f) => ({ ...f, sizeAdjs: arr }));
                    }}
                    className={`${fieldClass} flex-1 min-w-[5rem]`}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={sa.adjustment}
                    onChange={(e) => {
                      const arr = [...form.sizeAdjs];
                      arr[i] = { ...arr[i], adjustment: e.target.value };
                      setForm((f) => ({ ...f, sizeAdjs: arr }));
                    }}
                    className={`${fieldClass} w-28 shrink-0`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        sizeAdjs: f.sizeAdjs.filter((_, j) => j !== i),
                      }))
                    }
                    className="text-danger text-sm px-2 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    sizeAdjs: [...f.sizeAdjs, { size: "", adjustment: 0 }],
                  }))
                }
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background"
              >
                + Add size
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Color adjustments</p>
              <p className="text-xs text-muted">
                Color names must match variant names (e.g. White, Black, Navy).
              </p>
              <div className="flex gap-2 text-xs font-medium text-muted px-1 max-w-md">
                <span className="flex-1 min-w-[5rem]">Color</span>
                <span className="w-28 shrink-0">Adjustment ($)</span>
                <span className="w-8 shrink-0" aria-hidden />
              </div>
              {form.colorAdjs.map((ca, i) => (
                <div key={i} className="flex items-center gap-2 max-w-md">
                  <input
                    placeholder="Black, White…"
                    value={ca.color}
                    onChange={(e) => {
                      const arr = [...form.colorAdjs];
                      arr[i] = { ...arr[i], color: e.target.value };
                      setForm((f) => ({ ...f, colorAdjs: arr }));
                    }}
                    className={`${fieldClass} flex-1 min-w-[5rem]`}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={ca.adjustment}
                    onChange={(e) => {
                      const arr = [...form.colorAdjs];
                      arr[i] = { ...arr[i], adjustment: e.target.value };
                      setForm((f) => ({ ...f, colorAdjs: arr }));
                    }}
                    className={`${fieldClass} w-28 shrink-0`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        colorAdjs: f.colorAdjs.filter((_, j) => j !== i),
                      }))
                    }
                    className="text-danger text-sm px-2 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    colorAdjs: [...f.colorAdjs, { color: "", adjustment: 0 }],
                  }))
                }
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background"
              >
                + Add color
              </button>
            </div>

            {form.sizeAdjs[0]?.size && form.colorAdjs[0]?.color ? (
              <p className="text-sm text-muted">
                Preview: {form.colorAdjs[0].color} / {form.sizeAdjs[0].size} = $
                {previewPrice(
                  String(form.sizeAdjs[0].size),
                  String(form.colorAdjs[0].color),
                )}
              </p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={save}
                className="rounded-lg bg-accent hover:bg-accent-hover text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {pending ? "Saving…" : form.id ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm(emptyForm());
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">All configs</h2>
        {configs.length === 0 ? (
          <div className="bg-panel border border-border rounded-lg p-8 text-center text-sm text-muted">
            No pricing configs yet. Click “Create pricing config”.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {configs.map((c) => (
              <div
                key={c.id}
                className="bg-panel border border-border rounded-lg p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.name}</p>
                  <div className="flex gap-2 shrink-0 text-sm">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="text-accent font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(c.id)}
                      className="text-danger font-medium disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-2xl font-semibold tabular-nums">
                  ${c.basePrice}
                </p>
                <p className="text-sm text-muted">
                  {c.sizeAdjustments.length} sizes ·{" "}
                  {c.colorAdjustments.length} colors
                </p>
                {c.sizeAdjustments.length > 0 ? (
                  <p className="text-xs text-muted">
                    Size:{" "}
                    {c.sizeAdjustments
                      .map(
                        (s) =>
                          `${s.size}${
                            s.adjustment
                              ? `(${s.adjustment > 0 ? "+" : ""}${s.adjustment})`
                              : ""
                          }`,
                      )
                      .join(", ")}
                  </p>
                ) : null}
                {c.colorAdjustments.length > 0 ? (
                  <p className="text-xs text-muted">
                    Colors:{" "}
                    {c.colorAdjustments
                      .map(
                        (x) =>
                          `${x.color}${
                            x.adjustment
                              ? `(${x.adjustment > 0 ? "+" : ""}${x.adjustment})`
                              : ""
                          }`,
                      )
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
