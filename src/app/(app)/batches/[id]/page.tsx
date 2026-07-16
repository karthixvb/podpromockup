import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { parseJson } from "@/lib/pod";
import { requireUser } from "@/lib/session";
import BatchDetailClient from "./BatchDetailClient";

type Params = Promise<{ id: string }>;

export default async function BatchDetailPage({
  params,
}: {
  params: Params;
}) {
  const user = await requireUser();
  const { id } = await params;

  const job = await prisma.batchJob.findFirst({
    where: { id },
    include: {
      templateSet: true,
      pricingConfig: true,
      productLinks: true,
      items: {
        orderBy: [{ sku: "asc" }, { createdAt: "asc" }],
        take: 100,
        include: {
          template: true,
          variant: true,
        },
      },
    },
  });

  if (!job) notFound();

  const owns = await prisma.shopConnection.findFirst({
    where: { userId: user.userId, shop: job.shop },
    select: { id: true },
  });
  if (!owns) notFound();

  const shop = job.shop;

  const [pending, processing, completed, failed] = await Promise.all([
    prisma.batchItem.count({ where: { jobId: job.id, status: "pending" } }),
    prisma.batchItem.count({
      where: { jobId: job.id, status: "processing" },
    }),
    prisma.batchItem.count({
      where: { jobId: job.id, status: "completed" },
    }),
    prisma.batchItem.count({ where: { jobId: job.id, status: "failed" } }),
  ]);

  const itemCounts = { pending, processing, completed, failed };
  const syncSummary = parseJson<{
    created: number;
    updated: number;
    published: number;
    products: number;
  } | null>(job.syncSummary, null);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/batches" className="text-sm text-accent font-medium">
          ← Batches
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">
          {job.name}
        </h1>
      </div>

      <BatchDetailClient
        shop={shop}
        job={{
          id: job.id,
          name: job.name,
          status: job.status,
          shopifySyncStatus: job.shopifySyncStatus,
          autoPublishShopify: job.autoPublishShopify,
          createAsDraft: job.createAsDraft,
          totalItems: job.totalItems,
          processedItems: job.processedItems,
          failedItems: job.failedItems,
          errorMessage: job.errorMessage,
          templateSetName: job.templateSet?.name ?? null,
          syncSummary,
          lastSyncedAt: job.lastSyncedAt?.toISOString() ?? null,
        }}
        itemCounts={itemCounts}
        productLinks={job.productLinks.map((link) => ({
          id: link.id,
          productTypeKey: link.productTypeKey,
          designSku: link.designSku,
          shopifyProductGid: link.shopifyProductGid,
          shopifyHandle: link.shopifyHandle,
        }))}
        items={job.items.map((item) => ({
          id: item.id,
          status: item.status,
          sku: item.sku,
          productType: item.template?.productType ?? null,
          variantName: item.variant?.name ?? null,
          sceneName: item.sceneName,
          resultUrl: item.resultUrl,
          errorMessage: item.errorMessage,
        }))}
      />
    </div>
  );
}
