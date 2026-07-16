import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { processBatchJob } from "@/lib/batch-worker";
import { getActiveShopForApi } from "@/lib/shop-context";

type Params = Promise<{ id: string }>;

export async function POST(
  request: Request,
  { params }: { params: Params },
) {
  try {
    const ctx = await getActiveShopForApi();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { shop, connection } = ctx;
    const { id } = await params;

    const job = await prisma.batchJob.findFirst({
      where: { id, shop },
    });
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      const result = await processBatchJob(
        job.id,
        shop,
        connection.accessToken,
      );
      return NextResponse.json({ ok: true, result });
    }

    const result = await processBatchJob(
      job.id,
      shop,
      connection.accessToken,
    );
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Process failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
