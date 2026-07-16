import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  getActiveShopConnection,
} from "@/lib/shop-context";
import { getSession } from "@/lib/session";

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

export async function POST(request: Request) {
  const auth = await requireShopApi();
  if ("error" in auth && auth.error) return auth.error;
  const { shop } = auth as { shop: string };

  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "create") {
    const name = String(form.get("name") || "").trim();
    const productType = String(form.get("productType") || "T-Shirt");
    const category = String(form.get("category") || "unisex");
    const basePrice = Number(form.get("basePrice") || 19.99);
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    const tpl = await prisma.template.create({
      data: {
        shop,
        name,
        productType,
        category,
        basePrice,
      },
    });
    return NextResponse.json({ ok: true, id: tpl.id });
  }

  if (intent === "delete") {
    const id = String(form.get("id") || "");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    await prisma.template.deleteMany({ where: { id, shop } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown intent" }, { status: 400 });
}
