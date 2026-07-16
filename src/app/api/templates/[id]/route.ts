import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getActiveShopConnection } from "@/lib/shop-context";
import { getSession } from "@/lib/session";
import { ensureReadableUrl } from "@/lib/storage";
import { uploadMockupImage } from "@/lib/upload";

async function requireShopApi() {
  const session = await getSession();
  if (!session.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const connection = await getActiveShopConnection(
    session.userId,
    session.activeShop,
  );
  if (!connection) {
    return {
      error: NextResponse.json({ error: "No store selected" }, { status: 400 }),
    };
  }
  return { shop: connection.shop };
}

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const auth = await requireShopApi();
  if ("error" in auth && auth.error) return auth.error;
  const { shop } = auth as { shop: string };

  const { id: templateId } = await ctx.params;
  const template = await prisma.template.findFirst({
    where: { id: templateId, shop },
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "update_template") {
    const pricingRaw = String(form.get("pricingConfigId") || "");
    await prisma.template.update({
      where: { id: template.id },
      data: {
        name: String(form.get("name") || template.name),
        description: String(form.get("description") || "") || null,
        basePrice: Number(form.get("basePrice") || template.basePrice),
        pricingConfigId: pricingRaw || null,
      },
    });
    return NextResponse.json({ ok: true, message: "Template saved" });
  }

  if (intent === "add_variant") {
    const name = String(form.get("name") || "").trim();
    const colorHex = String(form.get("colorHex") || "#FFFFFF");
    if (!name) {
      return NextResponse.json({ error: "Variant name is required" }, { status: 400 });
    }
    const isFirst =
      (await prisma.variant.count({ where: { templateId: template.id } })) === 0;
    const variant = await prisma.variant.create({
      data: {
        templateId: template.id,
        name,
        colorHex,
        isPrimary: isFirst,
      },
    });
    await prisma.variantScene.create({
      data: {
        variantId: variant.id,
        name: "Main",
        isPrimary: true,
        sortOrder: 0,
      },
    });
    return NextResponse.json({ ok: true, message: "Variant added" });
  }

  if (intent === "delete_variant") {
    const id = String(form.get("id"));
    await prisma.variant.deleteMany({
      where: { id, templateId: template.id },
    });
    return NextResponse.json({ ok: true, message: "Variant deleted" });
  }

  if (intent === "set_primary_variant") {
    const id = String(form.get("id"));
    await prisma.variant.updateMany({
      where: { templateId: template.id },
      data: { isPrimary: false },
    });
    await prisma.variant.updateMany({
      where: { id, templateId: template.id },
      data: { isPrimary: true },
    });
    return NextResponse.json({ ok: true, message: "Primary color set" });
  }

  if (intent === "add_scene") {
    const variantId = String(form.get("variantId"));
    const name = String(form.get("name") || "Scene").trim();
    const owned = await prisma.variant.findFirst({
      where: { id: variantId, templateId: template.id },
    });
    if (!owned) {
      return NextResponse.json({ error: "Invalid variant" }, { status: 400 });
    }
    const count = await prisma.variantScene.count({ where: { variantId } });
    await prisma.variantScene.create({
      data: { variantId, name, sortOrder: count },
    });
    return NextResponse.json({ ok: true, message: "Scene added" });
  }

  if (intent === "delete_scene") {
    const id = String(form.get("id"));
    const scene = await prisma.variantScene.findUnique({
      where: { id },
      include: { variant: true },
    });
    if (!scene || scene.variant.templateId !== template.id) {
      return NextResponse.json({ error: "Invalid scene" }, { status: 400 });
    }
    const count = await prisma.variantScene.count({
      where: { variantId: scene.variantId },
    });
    if (count <= 1) {
      return NextResponse.json(
        { error: "Each variant needs at least one scene" },
        { status: 400 },
      );
    }
    await prisma.variantScene.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Scene deleted" });
  }

  if (intent === "set_primary_scene") {
    const id = String(form.get("id"));
    const variantId = String(form.get("variantId"));
    const owned = await prisma.variant.findFirst({
      where: { id: variantId, templateId: template.id },
    });
    if (!owned) {
      return NextResponse.json({ error: "Invalid variant" }, { status: 400 });
    }
    await prisma.variantScene.updateMany({
      where: { variantId },
      data: { isPrimary: false },
    });
    await prisma.variantScene.update({
      where: { id },
      data: { isPrimary: true },
    });
    return NextResponse.json({ ok: true, message: "Primary scene set" });
  }

  if (intent === "toggle_scene_flag") {
    const id = String(form.get("id"));
    const field = String(form.get("field"));
    const value = form.get("value") === "1";
    if (field !== "useLightImage" && field !== "useDarkImage") {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 });
    }
    const scene = await prisma.variantScene.findUnique({
      where: { id },
      include: { variant: true },
    });
    if (!scene || scene.variant.templateId !== template.id) {
      return NextResponse.json({ error: "Invalid scene" }, { status: 400 });
    }
    await prisma.variantScene.update({
      where: { id },
      data: { [field]: value },
    });
    return NextResponse.json({ ok: true });
  }

  if (intent === "save_crop") {
    const id = String(form.get("id"));
    const cropRegion = JSON.stringify({
      x: Number(form.get("cropX") || 50),
      y: Number(form.get("cropY") || 50),
      width: Number(form.get("cropW") || 200),
      height: Number(form.get("cropH") || 250),
    });
    const scene = await prisma.variantScene.findUnique({
      where: { id },
      include: { variant: true },
    });
    if (!scene || scene.variant.templateId !== template.id) {
      return NextResponse.json({ error: "Invalid scene" }, { status: 400 });
    }
    await prisma.variantScene.update({
      where: { id },
      data: { cropRegion },
    });
    return NextResponse.json({ ok: true, message: "Print area saved" });
  }

  if (intent === "sync_crop_scenes") {
    const cropRegion = JSON.stringify({
      x: Number(form.get("cropX") || 50),
      y: Number(form.get("cropY") || 50),
      width: Number(form.get("cropW") || 200),
      height: Number(form.get("cropH") || 250),
    });
    const scope = String(form.get("scope") || "template");

    const currentSceneId = form.get("id");
    if (currentSceneId) {
      const scene = await prisma.variantScene.findUnique({
        where: { id: String(currentSceneId) },
        include: { variant: true },
      });
      if (scene && scene.variant.templateId === template.id) {
        await prisma.variantScene.update({
          where: { id: String(currentSceneId) },
          data: { cropRegion },
        });
      }
    }

    if (scope === "variant") {
      const variantId = String(form.get("variantId") || "");
      const variant = await prisma.variant.findFirst({
        where: { id: variantId, templateId: template.id },
      });
      if (!variant) {
        return NextResponse.json({ error: "Invalid variant" }, { status: 400 });
      }
      const result = await prisma.variantScene.updateMany({
        where: { variantId },
        data: { cropRegion },
      });
      return NextResponse.json({
        ok: true,
        message: `Print area synced to ${result.count} scenes for ${variant.name}`,
        syncedAt: Date.now(),
        cropRegion,
      });
    }

    const variants = await prisma.variant.findMany({
      where: { templateId: template.id },
      select: { id: true },
    });
    const variantIds = variants.map((v) => v.id);
    if (variantIds.length === 0) {
      return NextResponse.json(
        { error: "Template has no variants yet" },
        { status: 400 },
      );
    }
    const result = await prisma.variantScene.updateMany({
      where: { variantId: { in: variantIds } },
      data: { cropRegion },
    });
    return NextResponse.json({
      ok: true,
      message: `Print area synced to ${result.count} scenes (all colors)`,
      syncedAt: Date.now(),
      cropRegion,
    });
  }

  if (intent === "upload_scene_image") {
    const id = String(form.get("id"));
    const file = form.get("file");
    if (!file || typeof file === "string" || !(file instanceof Blob) || !file.size) {
      return NextResponse.json({ error: "No file selected" }, { status: 400 });
    }
    const scene = await prisma.variantScene.findUnique({
      where: { id },
      include: { variant: true },
    });
    if (!scene || scene.variant.templateId !== template.id) {
      return NextResponse.json({ error: "Invalid scene" }, { status: 400 });
    }
    try {
      const uploadFile = file as File;
      const imageUrl = await uploadMockupImage(shop, id, uploadFile);
      await prisma.variantScene.update({
        where: { id },
        data: { imageUrl },
      });
      return NextResponse.json({
        ok: true,
        message: "Mockup image uploaded",
        imageUrl: ensureReadableUrl(imageUrl),
        sceneId: id,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Unknown intent" }, { status: 400 });
}
