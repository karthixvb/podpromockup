import Link from "next/link";
import prisma from "@/lib/db";
import { getOnboardingSteps } from "@/lib/onboarding";
import { requireActiveShop } from "@/lib/shop-context";
import OnboardingChecklist from "@/components/OnboardingChecklist";

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
    onboarding,
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
    getOnboardingSteps(shop),
  ]);

  const hasLambda = Boolean(process.env.AWS_LAMBDA_COMPOSITE_URL);
  const hasS3 = Boolean(process.env.AWS_S3_BUCKET);
  const showOnboarding = onboarding.completed < onboarding.total;

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
          <p className="text-sm text-muted mt-1">Overview for {shop}</p>
        </div>
        <Link
          href="/batches/new"
          className="rounded-lg bg-accent hover:bg-accent-hover text-white px-4 py-2 text-sm font-medium"
        >
          New batch
        </Link>
      </div>

      {showOnboarding ? (
        <OnboardingChecklist
          steps={onboarding.steps}
          completed={onboarding.completed}
          total={onboarding.total}
        />
      ) : null}

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
          <h2 className="text-base font-semibold">Systems</h2>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              hasLambda && hasS3
                ? "bg-accent/10 text-accent"
                : "bg-warning/10 text-warning"
            }`}
          >
            {hasLambda && hasS3 ? "Processing ready" : "Needs configuration"}
          </span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 text-sm">
          <li>Image processing: {hasLambda ? "Ready" : "Not configured"}</li>
          <li>Image storage: {hasS3 ? "Ready" : "Not configured"}</li>
          <li>
            <Link href="/storefront" className="text-accent font-medium">
              Storefront setup guide
            </Link>
          </li>
          <li>
            <Link href="/activity" className="text-accent font-medium">
              View activity log
            </Link>
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
          <p className="text-sm text-muted">
            No batches yet.{" "}
            <Link href="/batches/new" className="text-accent font-medium">
              Create one
            </Link>
          </p>
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
