import Link from "next/link";

const NOTES = [
  {
    version: "1.2",
    date: "2026-07-16",
    items: [
      "Publish synced products to Shopify sales channels",
      "Hide theme Color picker only on POD products",
      "Commercial polish: onboarding, activity, storefront guide, sync summary",
    ],
  },
  {
    version: "1.1",
    date: "2026-07-16",
    items: [
      "Faster menu navigation with skeletons",
      "Batch progress UI that auto-hides when done",
      "Sync always targets the shop that owns the batch",
    ],
  },
  {
    version: "1.0",
    date: "2026-07",
    items: [
      "Multi-store OAuth, templates, sets, pricing, batches",
      "Lambda compose + S3 storage + Shopify product upsert",
    ],
  },
];

export default function WhatsNewPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">What’s new</h1>
        <p className="text-sm text-muted mt-1">Product updates for POD Pro</p>
      </div>
      <div className="space-y-4">
        {NOTES.map((n) => (
          <section
            key={n.version}
            className="bg-panel border border-border rounded-lg p-5 space-y-2"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">v{n.version}</h2>
              <span className="text-xs text-muted">{n.date}</span>
            </div>
            <ul className="text-sm text-muted space-y-1 list-disc pl-5">
              {n.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="text-sm text-muted">
        Need help?{" "}
        <a
          href="mailto:support@example.com?subject=POD%20Pro%20support"
          className="text-accent font-medium"
        >
          Contact support
        </a>{" "}
        ·{" "}
        <Link href="/dashboard" className="text-accent font-medium">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
