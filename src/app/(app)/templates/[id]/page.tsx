import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { requireActiveShop } from "@/lib/shop-context";
import { ensureReadableUrl } from "@/lib/storage";
import TemplateEditorClient from "./TemplateEditorClient";

function withReadableImages<
  T extends {
    variants: {
      scenes: { imageUrl: string | null; [key: string]: unknown }[];
      [key: string]: unknown;
    }[];
  },
>(template: T): T {
  return {
    ...template,
    variants: template.variants.map((v) => ({
      ...v,
      scenes: v.scenes.map((s) => ({
        ...s,
        imageUrl: s.imageUrl ? ensureReadableUrl(s.imageUrl) ?? s.imageUrl : s.imageUrl,
      })),
    })),
  };
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TemplateDetailPage({ params }: PageProps) {
  const { shop } = await requireActiveShop();
  const { id } = await params;

  const [template, pricingConfigs] = await Promise.all([
    prisma.template.findFirst({
      where: { id, shop },
      include: {
        pricingConfig: true,
        variants: {
          orderBy: { createdAt: "asc" },
          include: { scenes: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
    prisma.pricingConfig.findMany({
      where: { shop },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!template) notFound();

  const readable = withReadableImages(template);

  return (
    <TemplateEditorClient
      template={{
        id: readable.id,
        name: readable.name,
        description: readable.description,
        productType: readable.productType,
        category: readable.category,
        basePrice: readable.basePrice,
        pricingConfigId: readable.pricingConfigId,
        pricingConfig: readable.pricingConfig
          ? { id: readable.pricingConfig.id, name: readable.pricingConfig.name }
          : null,
        variants: readable.variants.map((v) => ({
          id: v.id,
          name: v.name,
          colorHex: v.colorHex,
          isPrimary: v.isPrimary,
          scenes: v.scenes.map((s) => ({
            id: s.id,
            variantId: s.variantId,
            name: s.name,
            imageUrl: s.imageUrl,
            cropRegion: s.cropRegion,
            useLightImage: s.useLightImage,
            useDarkImage: s.useDarkImage,
            isPrimary: s.isPrimary,
            sortOrder: s.sortOrder,
          })),
        })),
      }}
      pricingConfigs={pricingConfigs.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
