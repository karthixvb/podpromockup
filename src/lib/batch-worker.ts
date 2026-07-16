import prisma from "@/lib/db";
import { compositeViaLambda } from "./composite";
import { storeResultImage, ensureReadableUrl } from "./storage";
import {
  parseDesignSources,
  parseJson,
  productTypeKey,
  resolveDesignUrl,
  sanitizeFilePart,
} from "./pod";
import { syncJobToShopify } from "./shopify-products";
import { envInt } from "./concurrency";
import type { BatchItem, Template, Variant, VariantScene } from "@prisma/client";

const BATCH_SIZE = envInt("POD_COMPOSE_CONCURRENCY", 6);
const STALE_MS = 2 * 60 * 1000;

type BatchItemWithRelations = BatchItem & {
  variant: Variant | null;
  scene: VariantScene | null;
  template: Template | null;
};

async function processSingleItem(item: BatchItemWithRelations): Promise<void> {
  const scene = item.scene;
  const variant = item.variant;
  if (!scene?.imageUrl) {
    throw new Error("Scene missing mockup image");
  }

  const sources = parseDesignSources(item.designUrl);
  const designUrl = resolveDesignUrl(
    sources,
    item.imageType || "auto",
    variant?.colorHex,
  );
  if (!designUrl) {
    throw new Error("No design URL for image type");
  }

  const cropRegion = parseJson(scene.cropRegion, {
    x: 50,
    y: 50,
    width: 200,
    height: 250,
  });

  const png = await compositeViaLambda({
    mockupUrl: ensureReadableUrl(scene.imageUrl) || scene.imageUrl,
    designUrl: ensureReadableUrl(designUrl) || designUrl,
    cropRegion,
  });

  const typePart = sanitizeFilePart(
    item.template?.productType || item.templateId || "tpl",
  );
  const fileName = `${sanitizeFilePart(item.sku)}_${typePart}_${sanitizeFilePart(variant?.name)}_${sanitizeFilePart(scene.name)}.png`;
  const objectKey = `${item.jobId}/${item.templateId || "na"}/${fileName}`;
  const resultUrl = await storeResultImage(objectKey, png);

  await prisma.batchItem.update({
    where: { id: item.id },
    data: { status: "completed", resultUrl, errorMessage: null },
  });
}

async function claimPendingItems(jobId: string): Promise<BatchItemWithRelations[]> {
  const staleBefore = new Date(Date.now() - STALE_MS);
  await prisma.batchItem.updateMany({
    where: {
      jobId,
      status: "processing",
      updatedAt: { lt: staleBefore },
    },
    data: { status: "pending" },
  });

  const pending = await prisma.batchItem.findMany({
    where: { jobId, status: "pending" },
    take: BATCH_SIZE,
    include: {
      variant: true,
      scene: true,
      template: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const claimed: BatchItemWithRelations[] = [];
  for (const item of pending) {
    const updated = await prisma.batchItem.updateMany({
      where: { id: item.id, status: "pending" },
      data: { status: "processing" },
    });
    if (updated.count === 1) claimed.push(item);
  }
  return claimed;
}

async function refreshJobCounters(jobId: string) {
  const [processed, failed, pending, processing] = await Promise.all([
    prisma.batchItem.count({ where: { jobId, status: "completed" } }),
    prisma.batchItem.count({ where: { jobId, status: "failed" } }),
    prisma.batchItem.count({ where: { jobId, status: "pending" } }),
    prisma.batchItem.count({ where: { jobId, status: "processing" } }),
  ]);

  const done = pending === 0 && processing === 0;
  await prisma.batchJob.update({
    where: { id: jobId },
    data: {
      processedItems: processed,
      failedItems: failed,
      status: done
        ? failed > 0 && processed === 0
          ? "failed"
          : "completed"
        : "processing",
    },
  });

  return { processed, failed, pending, processing, done };
}

export interface ProcessBatchJobResult {
  status: string;
  processed?: number;
  failed?: number;
  pending?: number;
  processing?: number;
  done?: boolean;
}

/**
 * Process one chunk of a batch job. Call repeatedly until done.
 * When complete and autoPublishShopify, sync products via Admin API.
 */
export async function processBatchJob(
  jobId: string,
  shop: string,
  accessToken: string,
): Promise<ProcessBatchJobResult> {
  const job = await prisma.batchJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (["paused", "cancelled"].includes(job.status)) {
    return { status: job.status };
  }

  if (job.status === "pending") {
    await prisma.batchJob.update({
      where: { id: jobId },
      data: { status: "processing" },
    });
  }

  if (job.status === "completed") {
    if (job.autoPublishShopify && job.shopifySyncStatus === "idle" && shop && accessToken) {
      await syncJobToShopify(jobId, shop, accessToken);
    }
    return { status: "completed" };
  }

  const claimed = await claimPendingItems(jobId);

  await Promise.all(
    claimed.map(async (item) => {
      try {
        await processSingleItem(item);
      } catch (err) {
        await prisma.batchItem.update({
          where: { id: item.id },
          data: {
            status: "failed",
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }),
  );

  const counters = await refreshJobCounters(jobId);

  if (counters.done) {
    const fresh = await prisma.batchJob.findUnique({ where: { id: jobId } });
    if (
      fresh?.autoPublishShopify &&
      fresh.status === "completed" &&
      fresh.shopifySyncStatus === "idle" &&
      shop &&
      accessToken
    ) {
      await syncJobToShopify(jobId, shop, accessToken);
    }
  }

  return { status: counters.done ? "completed" : "processing", ...counters };
}

export { productTypeKey };
