import prisma from "@/lib/db";
import { parseJson } from "@/lib/pod";
import { requireActiveShop } from "@/lib/shop-context";
import PricingClient, { type PricingConfigView } from "./PricingClient";

export default async function PricingPage() {
  const { shop } = await requireActiveShop();

  const rows = await prisma.pricingConfig.findMany({
    where: { shop },
    orderBy: { name: "asc" },
  });

  const configs: PricingConfigView[] = rows.map((c) => {
    const sizeAdjustments = parseJson<{ size: string; adjustment: number }[]>(
      c.sizeAdjustments,
      [],
    );
    const colorRaw = parseJson<{ color?: string; name?: string; adjustment?: number }[]>(
      c.colorAdjustments,
      [],
    );
    return {
      id: c.id,
      name: c.name,
      basePrice: c.basePrice,
      sizeAdjustments,
      colorAdjustments: colorRaw.map((x) => ({
        color: x.color || x.name || "",
        adjustment: x.adjustment ?? 0,
      })),
    };
  });

  return <PricingClient configs={configs} />;
}
