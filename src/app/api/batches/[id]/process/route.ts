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
    const intent = String(body.intent || "process");

    if (intent === "pause") {
      await prisma.batchJob.update({
        where: { id: job.id },
        data: { status: "paused" },
      });
      return NextResponse.json({ ok: true });
    }

    if (intent === "resume") {
      await prisma.batchJob.update({
        where: { id: job.id },
        data: { status: "processing" },
      });
      const result = await processBatchJob(job.id, job.shop, connection.accessToken);
      return NextResponse.json({ ok: true, result });
    }

    const result = await processBatchJob(job.id, job.shop, connection.accessToken);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Process failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
