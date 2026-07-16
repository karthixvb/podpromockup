"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORY_OPTIONS, PRODUCT_TYPE_OPTIONS } from "@/lib/pod";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ToastProvider";

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  productType: string;
  category: string;
  basePrice: number;
  variantCount: number;
};

type Props = {
  templates: TemplateRow[];
};

export default function TemplatesClient({ templates }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [productType, setProductType] = useState(PRODUCT_TYPE_OPTIONS[0]);
  const [category, setCategory] = useState("unisex");
  const [basePrice, setBasePrice] = useState("19.99");
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.set("intent", "create");
      fd.set("name", name.trim());
      fd.set("productType", productType);
      fd.set("category", category);
      fd.set("basePrice", basePrice);
      const res = await fetch("/api/templates", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.id) {
        setMessage(data.error || "Could not create template");
        return;
      }
      router.push(`/templates/${data.id}`);
    } catch {
      setMessage("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string, templateName: string) {
    setPendingDelete({ id, name: templateName });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    setBusy(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.set("intent", "delete");
      fd.set("id", id);
      const res = await fetch("/api/templates", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not delete template");
        toast.push(data.error || "Could not delete template", "error");
        return;
      }
      toast.push("Template deleted", "success");
      router.refresh();
    } catch {
      setMessage("Network error");
      toast.push("Network error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete template?"
        description={`“${pendingDelete?.name}” and its variants/scenes will be removed. Batches that referenced it may skip those items.`}
        danger
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />

      {message ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {message}
        </p>
      ) : null}

      <section
        id="create"
        className="rounded-xl border border-border bg-panel p-6 shadow-sm scroll-mt-6"
      >
        <h2 className="text-lg font-semibold tracking-tight">Create template</h2>
        <p className="mt-1 text-sm text-muted">
          Each template is one garment type. Open the editor to add colors, scenes, and
          set the print area.
        </p>
        <form onSubmit={onCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="T-Shirt"
              required
              className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Product type
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2"
            >
              {PRODUCT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Base price
            <input
              type="number"
              step="0.01"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {busy ? "Creating…" : "+ Create template"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">All templates</h2>
        {templates.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No templates yet"
              description="Create a T-Shirt or Hoodie template, upload mockups, and set the print crop area before running batches."
              actionHref="#create"
              actionLabel="Scroll to create"
              secondaryHref="/dashboard"
              secondaryLabel="View setup checklist"
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-border bg-white p-4"
              >
                <Link
                  href={`/templates/${t.id}`}
                  className="min-w-0 flex-1 text-inherit no-underline"
                >
                  <strong className="text-base text-accent">{t.name}</strong>
                  <div className="mt-1 text-sm text-muted">
                    {t.description || "No description"}
                  </div>
                  <div className="mt-2 text-sm">
                    {t.variantCount} variants · {t.productType} · {t.category}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Base ${t.basePrice.toFixed(2)}
                  </div>
                  <div className="mt-2 text-xs font-medium text-accent">
                    Open editor →
                  </div>
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(t.id, t.name)}
                  className="shrink-0 rounded-lg border border-danger/40 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/5 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
