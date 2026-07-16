import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { processBatchJob } from "@/lib/batch-worker";
import { buildDesignPayload, parseDesignsJson } from "@/lib/pod";
import { getActiveShopForApi } from "@/lib/shop-context";

function optionalId(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s || s === "undefined" || s === "null" || s === "None") return null;
  return s;
}

export async function POST(request: Request) {
  try {
    const ctx = await getActiveShopForApi();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { shop, connection } = ctx;
    const body = await request.json();

    const name = String(body.name || "").trim();
    const templateSetId = optionalId(body.templateSetId);
    let pricingConfigId = optionalId(body.pricingConfigId);
    const autoPublish = Boolean(body.autoPublishShopify);
    const createAsDraft = Boolean(body.createAsDraft);
    const designsJson = String(body.designsJson || "");

    if (!name || !templateSetId || !designsJson.trim()) {
      return NextResponse.json(
        {
          error:
            "Batch name, template set, and designs JSON are required (paste or upload a .json file).",
        },
        { status: 400 },
      );
    }

    if (pricingConfigId) {
      const pricing = await prisma.pricingConfig.findFirst({
        where: { id: pricingConfigId, shop },
        select: { id: true },
      });
      if (!pricing) pricingConfigId = null;
    }

    const parsed = parseDesignsJson(designsJson);
    if (!parsed.ok) {
      return NextResponse.json(
        {
          error: parsed.error || "Invalid designs JSON",
          rejected: parsed.rejected?.slice(0, 10),
        },
        { status: 400 },
      );
    }

    const designs = parsed.designs;

    const set = await prisma.templateSet.findFirst({
      where: { id: templateSetId, shop },
      include: {
        members: {
          include: {
            template: {
              include: {
                variants: {
                  include: { scenes: true },
                },
              },
            },
          },
        },
      },
    });

    if (!set || set.members.length === 0) {
      return NextResponse.json(
        { error: "Template set is empty or was not found." },
        { status: 400 },
      );
    }

    const items: {
      templateId: string;
      variantId: string;
      sceneId: string;
      sceneName: string;
      sku: string;
      title: string;
      description: string | null;
      tags: string;
      designUrl: string;
      imageType: string;
    }[] = [];

    for (const design of designs) {
      for (const member of set.members) {
        const template = member.template;
        if (!template) continue;
        for (const variant of template.variants) {
          for (const scene of variant.scenes) {
            if (!scene.imageUrl) continue;
            const useLight = scene.useLightImage !== false;
            const useDark = scene.useDarkImage !== false;
            const hasLight = useLight && Boolean(design.lightImageUrl);
            const hasDark = useDark && Boolean(design.darkImageUrl);
            if (!hasLight && !hasDark) continue;

            let imageType = "auto";
            if (hasLight && !hasDark) imageType = "light";
            else if (!hasLight && hasDark) imageType = "dark";

            items.push({
              templateId: template.id,
              variantId: variant.id,
              sceneId: scene.id,
              sceneName: scene.name,
              sku: design.sku,
              title: design.title,
              description: design.description || null,
              tags: JSON.stringify(design.tags || []),
              designUrl: buildDesignPayload(design),
              imageType,
            });
          }
        }
      }
    }

    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            "No compatible items — check that mockup images are uploaded and light/dark design URLs match scene settings.",
        },
        { status: 400 },
      );
    }

    let job: { id: string } | null = null;
    try {
      job = await prisma.batchJob.create({
        data: {
          shop,
          name,
          templateSetId: set.id,
          ...(pricingConfigId ? { pricingConfigId } : {}),
          autoPublishShopify: autoPublish,
          createAsDraft,
          totalItems: items.length,
          status: "pending",
        },
      });

      await prisma.batchItem.createMany({
        data: items.map((it) => ({ ...it, jobId: job!.id })),
      });
    } catch (err) {
      console.error("batch create failed", err);
      if (job?.id) {
        await prisma.batchJob.delete({ where: { id: job.id } }).catch(() => {});
      }
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? `Could not create batch: ${err.message}`
              : "Could not create batch due to a database error",
        },
        { status: 500 },
      );
    }

    try {
      await processBatchJob(job.id, shop, connection.accessToken);
    } catch (err) {
      console.error("Initial process error", err);
    }

    return NextResponse.json({ id: job.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
