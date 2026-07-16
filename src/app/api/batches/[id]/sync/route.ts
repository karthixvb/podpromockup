import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { syncJobToShopify } from "@/lib/shopify-products";
import { getSession } from "@/lib/session";

type Params = Promise<{ id: string }>;

export async function POST(
  _request: Request,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;

    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await prisma.batchJob.findUnique({
      where: { id },
    });
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const connection = await prisma.shopConnection.findFirst({
      where: { userId: session.userId, shop: job.shop },
    });
    if (!connection) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.batchJob.update({
      where: { id: job.id },
      data: { shopifySyncStatus: "idle" },
    });

    const summary = await syncJobToShopify(
      job.id,
      job.shop,
      connection.accessToken,
    );
    return NextResponse.json({
      ok: true,
      summary,
      message: `Synced ${summary.products} products (${summary.created} created, ${summary.updated} updated, ${summary.published} published)`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    const friendly = message.includes("publications")
      ? "Missing publication scopes. Reconnect the store under Stores after updating SCOPES."
      : message;
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
