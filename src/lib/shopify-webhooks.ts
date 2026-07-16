import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify Shopify webhook HMAC (X-Shopify-Hmac-Sha256). Returns false if verification is possible but fails. */
export function verifyShopifyWebhookHmac(
  rawBody: string,
  hmacHeader: string | null,
): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    // Cannot verify without secret — allow in local/dev when unset.
    return true;
  }
  if (!hmacHeader) return false;

  const digest = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(hmacHeader);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function shopDomainFromWebhook(request: Request): string | null {
  const domain =
    request.headers.get("X-Shopify-Shop-Domain") ||
    request.headers.get("x-shopify-shop-domain");
  return domain?.trim().toLowerCase() || null;
}
