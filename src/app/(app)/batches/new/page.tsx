import Link from "next/link";
import prisma from "@/lib/db";
import { requireActiveShop } from "@/lib/shop-context";
import NewBatchForm from "./NewBatchForm";

export default async function NewBatchPage() {
  const { shop } = await requireActiveShop();

  const [sets, pricing, settings] = await Promise.all([
    prisma.templateSet.findMany({
      where: { shop },
      include: {
        members: { include: { template: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.pricingConfig.findMany({
      where: { shop },
      orderBy: { name: "asc" },
    }),
    prisma.shopSettings.findUnique({ where: { shop } }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/batches" className="text-sm text-accent font-medium">
          ← Batches
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">
          New batch
        </h1>
        <p className="text-sm text-muted mt-1">
          Upload or paste designs JSON and expand across a template set.
        </p>
      </div>

      <NewBatchForm
        sets={sets.map((s) => ({
          id: s.id,
          name: s.name,
          memberCount: s.members.length,
          productTypes: s.members.map((m) => m.template.productType),
        }))}
        pricing={pricing.map((p) => ({ id: p.id, name: p.name }))}
        defaultCreateAsDraft={settings?.defaultProductStatus === "DRAFT"}
      />
    </div>
  );
}
