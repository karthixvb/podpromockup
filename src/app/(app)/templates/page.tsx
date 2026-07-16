import prisma from "@/lib/db";
import { requireActiveShop } from "@/lib/shop-context";
import TemplatesClient from "./TemplatesClient";

export default async function TemplatesPage() {
  const { shop } = await requireActiveShop();

  const templates = await prisma.template.findMany({
    where: { shop },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { variants: true } } },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="mt-1 text-sm text-muted">
          Manage mockup templates for {shop}
        </p>
      </header>
      <TemplatesClient
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          productType: t.productType,
          category: t.category,
          basePrice: t.basePrice,
          variantCount: t._count.variants,
        }))}
      />
    </div>
  );
}
