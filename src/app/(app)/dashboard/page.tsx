import Link from "next/link";
import prisma from "@/lib/db";
import { requireActiveShop } from "@/lib/shop-context";

function statusClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-accent/10 text-accent";
    case "processing":
      return "bg-warning/10 text-warning";
    case "failed":
      return "bg-danger/10 text-danger";
    default:
      return "bg-background text-muted";
  }
}

function syncClass(status: string) {
  if (status === "synced") return "bg-accent/10 text-accent";
  if (status === "failed") return "bg-danger/10 text-danger";
  return "bg-background text-muted";
}

export default async function DashboardPage() {
  const { shop } = await requireActiveShop();

  const [
    templates,
    sets,
    activeJobs,
    completedJobs,
    syncedProducts,
    failedSync,
    recent,
  ] = await Promise.all([
    prisma.template.count({ where: { shop } }),
    prisma.templateSet.count({ where: { shop } }),
    prisma.batchJob.count({
      where: { shop, status: { in: ["pending", "processing"] } },
    }),
    prisma.batchJob.count({ where: { shop, status: "completed" } }),
    prisma.shopifyProductLink.count({ where: { shop } }),
    prisma.batchJob.count({
      where: { shop, shopifySyncStatus: "failed" },
    }),
    prisma.batchJob.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const hasLambda = Boolean(process.env.AWS_LAMBDA_COMPOSITE_URL);
  const hasS3 = Boolean(process.env.AWS_S3_BUCKET);
  const ready = templates > 0 && sets > 0 && hasLambda && hasS3;

  const kpis: { label: string; value: number; warn?: boolean }[] = [
    { label: "Templates", value: templates },
    { label: "Template sets", value: sets },
    { label: "Active batches", value: activeJobs },
    { label: "Completed", value: completedJobs },
    { label: "Shopify products linked", value: syncedProducts },
  ];
  if (failedSync > 0) {
    kpis.push({ label: "Sync failed", value: failedSync, warn: true });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Overview for {shop}
          </p>
        </div>
        <Link
          href="/batches/new"
          className="rounded-lg bg-accent hover:bg-accent-hover text-white px-4 py-2 text-sm font-medium"
        >
          New batch
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-panel border border-border rounded-lg p-4"
          >
            <p className="text-sm text-muted">{kpi.label}</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                kpi.warn ? "text-danger" : ""
              }`}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </section>

      <section className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Go-live readiness</h2>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              ready
                ? "bg-accent/10 text-accent"
                : "bg-warning/10 text-warning"
            }`}
          >
            {ready ? "Ready to run batches" : "Setup incomplete"}
          </span>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2">
            <span className="w-4 shrink-0">{templates > 0 ? "✓" : "✗"}</span>
            <span>
              Templates —{" "}
              <Link href="/templates" className="text-accent font-medium">
                manage
              </Link>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="w-4 shrink-0">{sets > 0 ? "✓" : "✗"}</span>
            <span>
              Template set —{" "}
              <Link href="/template-sets" className="text-accent font-medium">
                manage
              </Link>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="w-4 shrink-0">{hasLambda ? "✓" : "✗"}</span>
            <span>
              Lambda composite URL{" "}
              {hasLambda ? "(configured)" : "(missing AWS_LAMBDA_COMPOSITE_URL)"}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="w-4 shrink-0">{hasS3 ? "✓" : "✗"}</span>
            <span>
              S3 bucket {hasS3 ? "(configured)" : "(missing AWS_S3_BUCKET)"}
            </span>
          </li>
        </ul>
      </section>

      <section className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Recent batches</h2>
          <Link href="/batches" className="text-sm text-accent font-medium">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">No batches yet.</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {recent.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/batches/${job.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-background"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{job.name}</p>
                    <p className="text-xs text-muted">
                      {job.processedItems}/{job.totalItems} items
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${statusClass(job.status)}`}
                    >
                      {job.status}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${syncClass(job.shopifySyncStatus)}`}
                    >
                      shopify: {job.shopifySyncStatus}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
