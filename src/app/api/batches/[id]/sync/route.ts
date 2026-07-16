import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { syncJobToShopify } from "@/lib/shopify-products";
import { getActiveShopForApi } from "@/lib/shop-context";

type Params = Promise<{ id: string }>;

export async function POST(
  _request: Request,
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

    await prisma.batchJob.update({
      where: { id: job.id },
      data: { shopifySyncStatus: "idle" },
    });
    await syncJobToShopify(job.id, shop, connection.accessToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
