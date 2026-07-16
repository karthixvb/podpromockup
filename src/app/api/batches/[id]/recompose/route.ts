import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { processBatchJob } from "@/lib/batch-worker";
import { getSession } from "@/lib/session";

type Params = Promise<{ id: string }>;

export async function POST(
  request: Request,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;

    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await prisma.batchJob.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const connection = await prisma.shopConnection.findFirst({
      where: { userId: session.userId, shop: job.shop },
    });
    if (!connection) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const scope = body.scope === "failed" ? "failed" : "all";

    const itemWhere =
      scope === "failed"
        ? { jobId: job.id, status: "failed" as const }
        : { jobId: job.id };

    const reset = await prisma.batchItem.updateMany({
      where: itemWhere,
      data: {
        status: "pending",
        resultUrl: null,
        errorMessage: null,
        shopifyProductId: null,
      },
    });

    if (reset.count === 0) {
      return NextResponse.json({
        ok: true,
        recomposed: false,
        error: "No items to recompose",
      });
    }

    const completed = await prisma.batchItem.count({
      where: { jobId: job.id, status: "completed" },
    });

    await prisma.batchJob.update({
      where: { id: job.id },
      data: {
        status: "processing",
        processedItems: scope === "all" ? 0 : completed,
        failedItems: 0,
        shopifySyncStatus: "idle",
        errorMessage: null,
      },
    });

    await processBatchJob(job.id, job.shop, connection.accessToken);
    return NextResponse.json({ ok: true, recomposed: true, scope });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recompose failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
