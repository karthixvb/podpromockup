import { NextResponse } from "next/server";
import { userOwnsShop } from "@/lib/shop-context";
import { getSession, setActiveShop } from "@/lib/session";
import { normalizeShop } from "@/lib/shopify";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const shopRaw = typeof body.shop === "string" ? body.shop : "";
    if (!shopRaw) {
      return NextResponse.json({ error: "Missing shop" }, { status: 400 });
    }

    const shop = normalizeShop(shopRaw);
    const owns = await userOwnsShop(session.userId, shop);
    if (!owns) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    await setActiveShop(shop);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Switch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
