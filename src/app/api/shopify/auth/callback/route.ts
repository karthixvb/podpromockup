import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { ensureShopSettings } from "@/lib/shop-context";
import { getSession, setActiveShop } from "@/lib/session";
import { completeOAuth, normalizeShop } from "@/lib/shopify";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const callback = await completeOAuth(request);
    const shopSession = callback.session;
    if (!shopSession?.shop || !shopSession.accessToken) {
      throw new Error("Missing shop or access token from OAuth callback");
    }

    const shop = normalizeShop(shopSession.shop);
    const accessToken = shopSession.accessToken;
    const scope =
      typeof shopSession.scope === "string" ? shopSession.scope : null;

    await prisma.shopConnection.upsert({
      where: {
        userId_shop: { userId: session.userId, shop },
      },
      create: {
        userId: session.userId,
        shop,
        accessToken,
        scope,
      },
      update: {
        accessToken,
        scope,
      },
    });

    await ensureShopSettings(shop);
    await setActiveShop(shop);

    return NextResponse.redirect(new URL("/stores?connected=1", request.url));
  } catch (err) {
    console.error("Shopify OAuth callback failed:", err);
    return NextResponse.redirect(new URL("/stores?error=oauth", request.url));
  }
}
