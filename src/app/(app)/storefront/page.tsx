import Link from "next/link";
import { requireActiveShop } from "@/lib/shop-context";

const STEPS = [
  {
    title: "Deploy the theme extension",
    body: "From your computer run shopify app deploy in the webapp project so the POD Product Experience block is available to every connected store.",
  },
  {
    title: "Add the block to the product template",
    body: "Online Store → Themes → Customize → Products → Default product → Add block → POD Product Experience. Place it near the buy buttons.",
  },
  {
    title: "Keep Color for normal products",
    body: "Do not hide Color globally in the theme Variant picker. The POD block setting “Hide theme Color option (POD products only)” hides Color only when POD swatches exist.",
  },
  {
    title: "Publish products to Online Store",
    body: "Synced Active products should publish automatically when write_publications is granted. Confirm Channels > 0 in Admin.",
  },
  {
    title: "Verify on a live product",
    body: "Open a synced product on the storefront. You should see type carousel (if multiple garments) and color swatches. Size remains in the theme picker.",
  },
];

export default async function StorefrontPage() {
  const { shop } = await requireActiveShop();
  const themeEditor = `https://${shop}/admin/themes/current/editor?template=product`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storefront</h1>
        <p className="text-sm text-muted mt-1">
          Theme setup for {shop} — POD block without breaking non-POD products
        </p>
      </div>

      <section className="bg-panel border border-border rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold">Quick open</h2>
        <p className="text-sm text-muted">
          Opens the theme editor for the product template on this store.
        </p>
        <a
          href={themeEditor}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-lg bg-accent hover:bg-accent-hover text-white px-4 py-2 text-sm font-medium"
        >
          Open theme editor
        </a>
      </section>

      <section className="bg-panel border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-base font-semibold">Setup checklist</h2>
        <ol className="space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-semibold">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-sm text-muted mt-1 leading-relaxed">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-panel border border-border rounded-lg p-5 space-y-2">
        <h2 className="text-base font-semibold">What customers see</h2>
        <ul className="text-sm text-muted space-y-1.5 list-disc pl-5">
          <li>Garment type carousel (T-Shirt / Hoodie…) when the design has multiple products</li>
          <li>POD color swatches driven by metafields</li>
          <li>Theme Size picker unchanged</li>
          <li>Non-POD products keep the normal Color picker</li>
        </ul>
        <p className="text-sm pt-2">
          Need products first?{" "}
          <Link href="/batches/new" className="text-accent font-medium">
            Create a batch
          </Link>
        </p>
      </section>
    </div>
  );
}
