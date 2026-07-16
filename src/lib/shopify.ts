import { shopifyApi, ApiVersion, type Shopify } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/node";

function hostNameFromEnv(): string {
  const host = process.env.HOST || "localhost:3000";
  return host.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function scopesFromEnv(): string[] {
  return (process.env.SCOPES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

let _shopify: Shopify | null = null;

/** Lazy init so `next build` works without Shopify credentials. */
export function getShopify(): Shopify {
  if (_shopify) return _shopify;

  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const apiSecretKey = process.env.SHOPIFY_API_SECRET || "";
  if (!apiKey || !apiSecretKey) {
    throw new Error(
      "SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be set to use Shopify OAuth",
    );
  }

  _shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes: scopesFromEnv(),
    hostName: hostNameFromEnv(),
    hostScheme: process.env.HOST?.startsWith("http://") ? "http" : "https",
    isEmbeddedApp: false,
    apiVersion: ApiVersion.July25,
  });
  return _shopify;
}

/** @deprecated Prefer getShopify() — kept for callers that already import `shopify`. */
export const shopify = new Proxy({} as Shopify, {
  get(_target, prop, receiver) {
    return Reflect.get(getShopify(), prop, receiver);
  },
});

/** Ensure shop is `*.myshopify.com` lowercase. */
export function normalizeShop(shop: string): string {
  let s = shop
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!s.includes(".")) {
    s = `${s}.myshopify.com`;
  }
  if (!s.endsWith(".myshopify.com")) {
    throw new Error(`Invalid shop domain: ${shop}`);
  }
  return s;
}

/** Minimal Node-like req/res so the node adapter works from App Router. */
function toNodeArgs(request: Request) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const resHeaders: Record<string, string | number | string[]> = {};
  const rawResponse = {
    statusCode: 200,
    statusMessage: "OK",
    getHeaders: () => resHeaders,
    setHeader: (key: string, value: string | number | readonly string[]) => {
      resHeaders[key] = value as string | number | string[];
    },
    write: () => true,
    end: () => rawResponse,
  };

  const rawRequest = {
    method: request.method,
    url: request.url,
    headers,
  };

  return { rawRequest, rawResponse, resHeaders };
}

function responseFromNodeHeaders(
  statusCode: number,
  resHeaders: Record<string, string | number | string[]>,
): Response {
  const headers = new Headers();
  for (const [key, value] of Object.entries(resHeaders)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, String(v));
    } else if (value !== undefined) {
      headers.set(key, String(value));
    }
  }
  return new Response(null, { status: statusCode, headers });
}

/**
 * Begin OAuth and return the Shopify authorize URL.
 * Uses shopify.auth.begin (callbackPath `/api/shopify/auth/callback`, isOnline: false).
 */
export async function beginOAuthUrl(shop: string): Promise<string> {
  const clean = normalizeShop(shop);
  const host = hostNameFromEnv();
  const scheme = process.env.HOST?.startsWith("http://") ? "http" : "https";
  const request = new Request(
    `${scheme}://${host}/api/shopify/auth?shop=${encodeURIComponent(clean)}`,
  );
  const { rawRequest, rawResponse, resHeaders } = toNodeArgs(request);

  await getShopify().auth.begin({
    shop: clean,
    callbackPath: "/api/shopify/auth/callback",
    isOnline: false,
    rawRequest,
    rawResponse,
  });

  const location = resHeaders.Location ?? resHeaders.location;
  if (!location || typeof location !== "string") {
    throw new Error("Failed to begin Shopify OAuth (no redirect Location)");
  }
  return location;
}

/** Start OAuth from an App Router Request; returns a redirect Response. */
export async function beginOAuth(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  if (!shopParam) {
    return Response.json({ error: "Missing shop" }, { status: 400 });
  }
  const clean = normalizeShop(shopParam);
  const { rawRequest, rawResponse, resHeaders } = toNodeArgs(request);

  await getShopify().auth.begin({
    shop: clean,
    callbackPath: "/api/shopify/auth/callback",
    isOnline: false,
    rawRequest,
    rawResponse,
  });

  return responseFromNodeHeaders(rawResponse.statusCode || 302, resHeaders);
}

/** Complete OAuth callback for App Router Request/Response. */
export async function completeOAuth(request: Request) {
  const { rawRequest, rawResponse } = toNodeArgs(request);
  return getShopify().auth.callback({
    rawRequest,
    rawResponse,
  });
}
