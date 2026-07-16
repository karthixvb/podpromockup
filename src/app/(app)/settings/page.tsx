import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { DEFAULT_SIZES, parseJson } from "@/lib/pod";
import { requireActiveShop } from "@/lib/shop-context";

async function saveSettings(formData: FormData) {
  "use server";

  const { shop } = await requireActiveShop();

  const sizes = String(formData.get("sizes") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const compareAtPercent = Math.max(
    0,
    Math.min(200, Number(formData.get("compareAtPercent") || 0) || 0),
  );
  const defaultProductStatus =
    String(formData.get("defaultProductStatus") || "ACTIVE") === "DRAFT"
      ? "DRAFT"
      : "ACTIVE";

  await prisma.shopSettings.upsert({
    where: { shop },
    create: {
      shop,
      vendor: String(formData.get("vendor") || "MyStore"),
      defaultSizes: JSON.stringify(sizes.length ? sizes : DEFAULT_SIZES),
      storagePrefix: String(formData.get("storagePrefix") || "") || null,
      compareAtPercent,
      defaultProductStatus,
    },
    update: {
      vendor: String(formData.get("vendor") || "MyStore"),
      defaultSizes: JSON.stringify(sizes.length ? sizes : DEFAULT_SIZES),
      storagePrefix: String(formData.get("storagePrefix") || "") || null,
      compareAtPercent,
      defaultProductStatus,
    },
  });

  revalidatePath("/settings");
}

export default async function SettingsPage() {
  const { shop } = await requireActiveShop();

  let settings = await prisma.shopSettings.findUnique({ where: { shop } });
  if (!settings) {
    settings = await prisma.shopSettings.create({ data: { shop } });
  }

  const sizes = parseJson(settings.defaultSizes, DEFAULT_SIZES).join(", ");
  const hasLambda = Boolean(process.env.AWS_LAMBDA_COMPOSITE_URL);
  const hasS3 = Boolean(process.env.AWS_S3_BUCKET);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-1">Shop defaults for {shop}</p>
      </div>

      <section className="bg-panel border border-border rounded-lg p-4 space-y-4">
        <h2 className="text-base font-semibold">Shop defaults</h2>
        <form action={saveSettings} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Vendor (brand on product)</span>
            <input
              name="vendor"
              defaultValue={settings.vendor}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 bg-white"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">
              Default sizes (comma-separated)
            </span>
            <input
              name="sizes"
              defaultValue={sizes}
              placeholder="S, M, L, XL, 2XL, 3XL"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 bg-white"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Storage folder prefix</span>
            <input
              name="storagePrefix"
              defaultValue={settings.storagePrefix || ""}
              placeholder="optional/path"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 bg-white"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">
              Compare-at markup % (0 = off, e.g. 25 for 25% strikethrough)
            </span>
            <input
              name="compareAtPercent"
              type="number"
              min={0}
              max={200}
              step={1}
              defaultValue={settings.compareAtPercent ?? 0}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 bg-white"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">
              Default product status on sync
            </span>
            <select
              name="defaultProductStatus"
              defaultValue={settings.defaultProductStatus || "ACTIVE"}
              className="mt-1 w-full max-w-xs rounded-lg border border-border px-3 py-2 bg-white"
            >
              <option value="ACTIVE">Active (sell immediately)</option>
              <option value="DRAFT">Draft (review first)</option>
            </select>
          </label>

          <button
            type="submit"
            className="rounded-lg bg-accent hover:bg-accent-hover text-white px-4 py-2 text-sm font-medium"
          >
            Save
          </button>
        </form>
      </section>

      <section id="health" className="bg-panel border border-border rounded-lg p-4 space-y-3 scroll-mt-6">
        <h2 className="text-base font-semibold">System health</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                hasLambda
                  ? "bg-accent/10 text-accent"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {hasLambda ? "Ready" : "Needs setup"}
            </span>
            <span>Image processing (compose)</span>
          </li>
          <li className="flex items-center gap-2">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                hasS3
                  ? "bg-accent/10 text-accent"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {hasS3 ? "Ready" : "Needs setup"}
            </span>
            <span>Image storage</span>
          </li>
        </ul>
        {!hasLambda || !hasS3 ? (
          <p className="text-sm text-muted">
            Contact your administrator to finish processing setup before large
            production batches.
          </p>
        ) : (
          <p className="text-sm text-muted">
            Processing stack is ready for this environment.
          </p>
        )}
      </section>

      <section className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-base font-semibold">Commercial checklist</h2>
        <ul className="space-y-2 text-sm list-disc pl-5">
          <li>
            Follow the{" "}
            <a href="/storefront" className="text-accent font-medium">
              Storefront guide
            </a>{" "}
            — add the POD block; Color is auto-hidden only on POD products.
          </li>
          <li>
            Install the <strong>Google &amp; YouTube</strong> sales channel for
            complete Google Shopping product data.
          </li>
          <li>
            Set vendor, compare-at pricing, and default product status above
            before running large batches.
          </li>
          <li>
            Re-syncing updates existing products for the same design and type —
            it does not create duplicates.
          </li>
          <li>
            After changing Shopify scopes, reconnect the store under{" "}
            <a href="/stores" className="text-accent font-medium">
              Stores
            </a>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
