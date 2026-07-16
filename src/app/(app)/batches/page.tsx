import Link from "next/link";
import prisma from "@/lib/db";
import { requireActiveShop } from "@/lib/shop-context";
import EmptyState from "@/components/EmptyState";

function statusClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-accent/10 text-accent";
    case "processing":
    case "pending":
      return "bg-warning/10 text-warning";
    case "failed":
      return "bg-danger/10 text-danger";
    case "paused":
      return "bg-background text-muted";
    default:
      return "bg-background text-muted";
  }
}

function syncClass(status: string) {
  if (status === "synced") return "bg-accent/10 text-accent";
  if (status === "failed" || status === "syncing") {
    return status === "failed"
      ? "bg-danger/10 text-danger"
      : "bg-warning/10 text-warning";
  }
  return "bg-background text-muted";
}

export default async function BatchesPage() {
  const { shop } = await requireActiveShop();

  const jobs = await prisma.batchJob.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    include: { templateSet: true },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
          <p className="text-sm text-muted mt-1">
            Compose mockups and sync products for {shop}
          </p>
        </div>
        <Link
          href="/batches/new"
          className="rounded-lg bg-accent hover:bg-accent-hover text-white px-4 py-2 text-sm font-medium"
        >
          New batch
        </Link>
      </div>

      <section className="bg-panel border border-border rounded-lg overflow-hidden">
        {jobs.length === 0 ? (
          <div className="p-2">
            <EmptyState
              title="No batches yet"
              description="Create a batch from a Template Set and a designs JSON file. We’ll compose mockups and sync products to this store."
              actionHref="/batches/new"
              actionLabel="Create batch"
              secondaryHref="/template-sets"
              secondaryLabel="Manage sets"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {jobs.map((job) => {
              const pct =
                job.totalItems > 0
                  ? Math.min(
                      100,
                      Math.round((job.processedItems / job.totalItems) * 100),
                    )
                  : 0;
              return (
                <li key={job.id}>
                  <Link
                    href={`/batches/${job.id}`}
                    className="flex flex-col gap-3 px-4 py-4 hover:bg-background sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium truncate">{job.name}</p>
                      <p className="text-xs text-muted truncate">
                        {job.templateSet?.name || "—"} · {job.processedItems}/
                        {job.totalItems} complete
                        {job.failedItems
                          ? ` · ${job.failedItems} failed`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-28 h-2 rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full bg-accent transition-[width]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
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
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
