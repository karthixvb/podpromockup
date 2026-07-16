import Link from "next/link";
import prisma from "@/lib/db";
import { parseJson } from "@/lib/pod";
import { requireActiveShop } from "@/lib/shop-context";
import EmptyState from "@/components/EmptyState";

export default async function ActivityPage() {
  const { shop } = await requireActiveShop();

  const logs = await prisma.activityLog.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted mt-1">
          Recent actions for {shop}
        </p>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Syncs, publishes, and important store events will appear here after you run batches."
          actionHref="/batches/new"
          actionLabel="Create a batch"
        />
      ) : (
        <ul className="bg-panel border border-border rounded-lg divide-y divide-border overflow-hidden">
          {logs.map((log) => {
            const meta = parseJson<Record<string, unknown>>(log.meta, {});
            return (
              <li key={log.id} className="px-4 py-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-background text-muted">
                    {log.action}
                  </span>
                  <time className="text-xs text-muted">
                    {log.createdAt.toLocaleString()}
                  </time>
                </div>
                <p className="text-sm">{log.message}</p>
                {typeof meta.jobId === "string" ? (
                  <Link
                    href={`/batches/${meta.jobId}`}
                    className="text-xs text-accent font-medium"
                  >
                    Open batch
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
