import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  shopDomainFromWebhook,
  verifyShopifyWebhookHmac,
} from "@/lib/shopify-webhooks";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmac =
    request.headers.get("X-Shopify-Hmac-Sha256") ||
    request.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhookHmac(rawBody, hmac)) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  const shop = shopDomainFromWebhook(request);
  if (shop) {
    let scope: string | undefined;
    try {
      const body = JSON.parse(rawBody) as { scope?: unknown; scopes?: unknown };
      if (typeof body.scope === "string") scope = body.scope;
      else if (typeof body.scopes === "string") scope = body.scopes;
    } catch {
      // ignore invalid JSON
    }

    if (scope !== undefined) {
      await prisma.shopConnection.updateMany({
        where: { shop },
        data: { scope },
      });
    }
  }

  return new NextResponse(null, { status: 200 });
}
