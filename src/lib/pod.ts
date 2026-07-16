/**
 * Shared POD helpers (safe for client + server)
 */

export function productTypeKey(productType: string | null | undefined): string {
  return String(productType || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Remove trailing garment type words from a design title (JSON often ends with "T-Shirt").
 * e.g. "England … Fans T-Shirt" → "England … Fans"
 *      "… T-Shirt Hoodie" → "…" (strip repeatedly)
 */
export function stripProductTypeLabels(title: string | null | undefined): string {
  let t = String(title || "").trim();
  const trailingType =
    /(?:^|[\s|,\-/]+)(?:t-?\s*shirts?|tee\s*shirts?|hoodies?|tank\s*tops?|sweatshirts?|long\s*sleeves?|crop\s*tops?|crewnecks?|tanks?)\s*$/i;

  let prev: string;
  do {
    prev = t;
    t = t.replace(trailingType, "").trim();
    t = t.replace(/[\s|,\-/]+$/g, "").trim();
  } while (t !== prev && t.length > 0);

  return t;
}

/**
 * Strip garment type words from description body (title-safe trailing strip is separate).
 * Keeps HTML tags; removes "T-Shirt", "Hoodie", etc. as whole words.
 */
export function stripProductTypeFromText(
  text: string | null | undefined,
): string | null | undefined {
  if (text == null || text === "") return text;
  let t = String(text);
  t = t.replace(
    /\b(t-?\s*shirts?|tee\s*shirts?|hoodies?|tank\s*tops?|sweatshirts?|long\s*sleeves?|crop\s*tops?|crewnecks?)\b/gi,
    "",
  );
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/ +([.,;:!?)])/g, "$1");
  t = t.replace(/\(\s+\)/g, "");
  return t.trim();
}

/**
 * Build a product title for a garment template.
 * e.g. "… Railroad T-Shirt" + Hoodie → "… Railroad Hoodie"
 */
export function titleForProductType(
  baseTitle: string | null | undefined,
  productType: string | null | undefined,
): string {
  const t = stripProductTypeLabels(baseTitle);
  const type = String(productType || "").trim();
  if (!type) return t;
  return t ? `${t} ${type}` : type;
}

/** Description synced to Shopify — no garment labels; type is only on the title. */
export function descriptionForProduct(
  description: string | null | undefined,
): string {
  return stripProductTypeFromText(description) || "";
}

/** Google product category path for Merchant Center / mm-google-shopping */
export function googleProductCategory(productType: string | null | undefined): string {
  const key = productTypeKey(productType);
  const map: Record<string, string> = {
    "t-shirt": "Apparel & Accessories > Clothing > Shirts & Tops",
    "long-sleeve": "Apparel & Accessories > Clothing > Shirts & Tops",
    "tank-top": "Apparel & Accessories > Clothing > Shirts & Tops",
    "crop-top": "Apparel & Accessories > Clothing > Shirts & Tops",
    hoodie: "Apparel & Accessories > Clothing > Outerwear",
    sweatshirt: "Apparel & Accessories > Clothing > Outerwear",
    crewneck: "Apparel & Accessories > Clothing > Outerwear",
  };
  return map[key] || "Apparel & Accessories > Clothing";
}

/** Map template category → Google Shopping gender */
export function googleGender(category: string | null | undefined): string {
  const c = String(category || "unisex").toLowerCase();
  if (["mens", "men", "male"].includes(c)) return "male";
  if (["womens", "women", "female"].includes(c)) return "female";
  return "unisex";
}

/** Map template category → Google Shopping age_group */
export function googleAgeGroup(category: string | null | undefined): string {
  const c = String(category || "unisex").toLowerCase();
  if (c === "baby" || c === "infant") return "infant";
  if (c === "toddler") return "toddler";
  if (["kids", "youth", "children"].includes(c)) return "kids";
  return "adult";
}

export interface GoogleShoppingMetafield {
  namespace: string;
  key: string;
  type: string;
  value: string;
}

/**
 * Metafields for Google & YouTube / Google Shopping channel (namespace mm-google-shopping).
 */
export function buildGoogleShoppingMetafields({
  productType,
  category,
  mpn,
}: {
  productType: string | null | undefined;
  category: string | null | undefined;
  mpn: string | null | undefined;
}): GoogleShoppingMetafield[] {
  return [
    {
      namespace: "mm-google-shopping",
      key: "google_product_category",
      type: "single_line_text_field",
      value: googleProductCategory(productType),
    },
    {
      namespace: "mm-google-shopping",
      key: "gender",
      type: "single_line_text_field",
      value: googleGender(category),
    },
    {
      namespace: "mm-google-shopping",
      key: "age_group",
      type: "single_line_text_field",
      value: googleAgeGroup(category),
    },
    {
      namespace: "mm-google-shopping",
      key: "mpn",
      type: "single_line_text_field",
      value: String(mpn || "").slice(0, 70),
    },
    {
      namespace: "mm-google-shopping",
      key: "condition",
      type: "single_line_text_field",
      value: "new",
    },
  ];
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export interface DesignSources {
  lightImage: string | null;
  darkImage: string | null;
  fallbackImage: string | null;
}

export function parseDesignSources(raw: string | null | undefined): DesignSources {
  if (!raw) return { lightImage: null, darkImage: null, fallbackImage: null };
  const value = String(raw).trim();
  if (!value.startsWith("{")) {
    return { lightImage: value, darkImage: value, fallbackImage: value };
  }
  try {
    const parsed = JSON.parse(value) as Record<string, string | null | undefined>;
    return {
      lightImage: parsed.light_image || null,
      darkImage: parsed.dark_image || null,
      fallbackImage:
        parsed.fallback_image ||
        parsed.light_image ||
        parsed.dark_image ||
        null,
    };
  } catch {
    return { lightImage: value, darkImage: value, fallbackImage: value };
  }
}

export function buildDesignPayload(design: {
  lightImageUrl?: string | null;
  darkImageUrl?: string | null;
}): string {
  return JSON.stringify({
    light_image: design.lightImageUrl || null,
    dark_image: design.darkImageUrl || null,
    fallback_image: design.lightImageUrl || design.darkImageUrl || null,
  });
}

export interface NormalizedDesign {
  sku: string;
  title: string;
  description: string | null;
  tags: string[];
  lightImageUrl: string | null;
  darkImageUrl: string | null;
}

export function normalizeDesignItem(item: unknown): NormalizedDesign | null {
  if (!item || typeof item !== "object") return null;

  const raw = item as Record<string, unknown>;
  const sku = String(
    raw.sku || raw.SKU || raw.product_sku || raw.id || "",
  ).trim();
  if (!sku) return null;

  const design =
    raw.design && typeof raw.design === "object"
      ? (raw.design as Record<string, unknown>)
      : {};
  const lightImageUrl =
    (design.light_image as string | undefined) ||
    (raw.light_image as string | undefined) ||
    (raw.lightImage as string | undefined) ||
    (raw.design_url as string | undefined) ||
    (raw.designUrl as string | undefined) ||
    (raw.image as string | undefined) ||
    (raw.image_url as string | undefined) ||
    (raw.imageUrl as string | undefined) ||
    null;
  const darkImageUrl =
    (design.dark_image as string | undefined) ||
    (raw.dark_image as string | undefined) ||
    (raw.darkImage as string | undefined) ||
    (raw.design_url as string | undefined) ||
    (raw.designUrl as string | undefined) ||
    null;

  if (!lightImageUrl && !darkImageUrl) return null;

  const rawTitle =
    (typeof raw.title === "string" ? raw.title.trim() : "") ||
    (typeof raw.name === "string" ? raw.name.trim() : "") ||
    (design.slug as string | undefined) ||
    (design.title as string | undefined) ||
    sku;

  const tags = raw.tags || design.tags || [];
  const tagList = Array.isArray(tags)
    ? (tags as string[])
    : String(tags)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

  return {
    sku,
    title: stripProductTypeLabels(rawTitle) || rawTitle,
    description:
      stripProductTypeFromText(
        (raw.description as string | undefined) ||
          (design.description as string | undefined),
      ) || null,
    tags: tagList,
    lightImageUrl,
    darkImageUrl,
  };
}

export interface RejectedDesign {
  index: number;
  sku: string | null;
  reason: string;
}

export interface ParseDesignsResult {
  ok: boolean;
  error: string | null;
  designs: NormalizedDesign[];
  rejected: RejectedDesign[];
  duplicateSkus?: string[];
  totalRaw: number;
}

/**
 * Parse designs JSON (array or { designs|items|products: [...] }).
 * Returns valid designs + rejected row hints for UI.
 */
export function parseDesignsJson(raw: unknown): ParseDesignsResult {
  const text = String(raw || "").trim();
  if (!text) {
    return {
      ok: false,
      error: "JSON is empty",
      designs: [],
      rejected: [],
      totalRaw: 0,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "Invalid JSON syntax",
      designs: [],
      rejected: [],
      totalRaw: 0,
    };
  }

  const parsedObj =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  const rawItems = Array.isArray(parsed)
    ? parsed
    : parsedObj?.designs ||
      parsedObj?.items ||
      parsedObj?.products ||
      parsedObj?.data ||
      [];

  if (!Array.isArray(rawItems)) {
    return {
      ok: false,
      error:
        "Expected an array of designs, or an object with a designs, items, or products field",
      designs: [],
      rejected: [],
      totalRaw: 0,
    };
  }

  const designs: NormalizedDesign[] = [];
  const rejected: RejectedDesign[] = [];
  const seenSku = new Set<string>();
  const duplicateSkus: string[] = [];

  rawItems.forEach((item, index) => {
    const d = normalizeDesignItem(item);
    if (!d) {
      const row =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : null;
      rejected.push({
        index,
        sku: (row?.sku as string | undefined) || (row?.id as string | undefined) || null,
        reason:
          "Missing SKU or image URL (light_image, dark_image, or design_url)",
      });
      return;
    }
    if (seenSku.has(d.sku)) {
      duplicateSkus.push(d.sku);
      return;
    }
    seenSku.add(d.sku);
    designs.push(d);
  });

  return {
    ok: designs.length > 0,
    error:
      designs.length === 0
        ? "No valid designs found (each item needs a SKU and at least one image URL)"
        : null,
    designs,
    rejected,
    duplicateSkus: [...new Set(duplicateSkus)],
    totalRaw: rawItems.length,
  };
}

export function getLuminance(hex: string | null | undefined): number {
  const color = String(hex || "#FFFFFF").replace("#", "").padEnd(6, "F");
  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function resolveDesignUrl(
  sources: DesignSources,
  mode: string,
  colorHex?: string | null,
): string | null {
  if (mode === "light") return sources.lightImage;
  if (mode === "dark") return sources.darkImage;
  if (colorHex != null) {
    const lum = getLuminance(colorHex);
    return lum > 0.5
      ? sources.darkImage || sources.lightImage || sources.fallbackImage
      : sources.lightImage || sources.darkImage || sources.fallbackImage;
  }
  return sources.fallbackImage || sources.lightImage || sources.darkImage;
}

export function sanitizeFilePart(value: string | null | undefined): string {
  return String(value || "item")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
}

export const DEFAULT_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

export const PRODUCT_TYPE_OPTIONS = [
  "T-Shirt",
  "Long Sleeve",
  "Hoodie",
  "Sweatshirt",
  "Tank Top",
  "Crewneck",
];

export const CATEGORY_OPTIONS = [
  "mens",
  "womens",
  "kids",
  "baby",
  "unisex",
];
