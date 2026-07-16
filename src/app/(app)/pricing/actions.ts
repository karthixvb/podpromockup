"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { requireActiveShop } from "@/lib/shop-context";

export type PricingActionResult = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export async function savePricingConfig(
  formData: FormData,
): Promise<PricingActionResult> {
  const { shop } = await requireActiveShop();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const basePrice = Number(formData.get("basePrice") || 0);

  let sizeAdjustments: { size?: string; adjustment?: number }[] = [];
  let colorAdjustments: { color?: string; adjustment?: number }[] = [];
  try {
    sizeAdjustments = JSON.parse(String(formData.get("sizeAdjustments") || "[]"));
    colorAdjustments = JSON.parse(
      String(formData.get("colorAdjustments") || "[]"),
    );
  } catch {
    return { error: "Invalid adjustment JSON" };
  }

  if (!name) return { error: "Name is required" };

  const payload = {
    name,
    basePrice,
    sizeAdjustments: JSON.stringify(
      sizeAdjustments
        .filter((s) => s.size?.trim())
        .map((s) => ({
          size: String(s.size).trim(),
          adjustment: Number(s.adjustment) || 0,
        })),
    ),
    colorAdjustments: JSON.stringify(
      colorAdjustments
        .filter((c) => c.color?.trim())
        .map((c) => ({
          color: String(c.color).trim(),
          adjustment: Number(c.adjustment) || 0,
        })),
    ),
  };

  if (id) {
    await prisma.pricingConfig.updateMany({
      where: { id, shop },
      data: payload,
    });
    revalidatePath("/pricing");
    return { ok: true, message: "Pricing updated" };
  }

  await prisma.pricingConfig.create({
    data: { shop, ...payload },
  });
  revalidatePath("/pricing");
  return { ok: true, message: "Pricing created" };
}

export async function deletePricingConfig(
  formData: FormData,
): Promise<PricingActionResult> {
  const { shop } = await requireActiveShop();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Missing id" };

  await prisma.pricingConfig.deleteMany({
    where: { id, shop },
  });
  revalidatePath("/pricing");
  return { ok: true, message: "Pricing deleted" };
}
