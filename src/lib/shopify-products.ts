import { randomUUID } from "node:crypto";
import prisma from "@/lib/db";
import {
  DEFAULT_SIZES,
  parseJson,
  productTypeKey,
  titleForProductType,
  descriptionForProduct,
  buildGoogleShoppingMetafields,
} from "./pod";
import { ensureReadableUrl } from "./storage";
import { envInt, mapPool } from "./concurrency";
import type {
  BatchItem,
  PricingConfig,
  Template,
  Variant,
  VariantScene,
} from "@prisma/client";

const SYNC_CONCURRENCY = envInt("POD_SYNC_CONCURRENCY", 5);

export type AdminGraphql = (
  query: string,
  options?: { variables?: object },
) => Promise<Response>;

/** Build a Shopify Admin GraphQL client from shop + access token (no Remix/React Router). */
export function createAdminGraphql(shop: string, accessToken: string): AdminGraphql {
  const shopDomain = shop
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const host = shopDomain.includes(".")
    ? shopDomain
    : `${shopDomain}.myshopify.com`;

  return async (query: string, options?: { variables?: object }) => {
    return fetch(`https://${host}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query,
        variables: options?.variables ?? {},
      }),
    });
  };
}

interface GraphQLError {
  message: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

async function gql<T>(
  adminGraphql: AdminGraphql,
  query: string,
  variables?: object,
): Promise<T> {
  const res = await adminGraphql(query, { variables });
  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data as T;
}

function colorCode(name: string | null | undefined): string {
  return String(name || "CLR")
    .replace(/\s+/g, "")
    .substring(0, 3)
    .toUpperCase();
}

interface PriceAdjustment {
  color?: string;
  name?: string;
  size?: string;
  adjustment?: number;
}

function computePrice(
  basePrice: number | null | undefined,
  colorName: string | null | undefined,
  size: string,
  pricing: PricingConfig | null | undefined,
): string {
  let price = Number(basePrice ?? pricing?.basePrice ?? 19.99);
  const colorAdj = parseJson<PriceAdjustment[]>(pricing?.colorAdjustments, []);
  const sizeAdj = parseJson<PriceAdjustment[]>(pricing?.sizeAdjustments, []);
  const c = colorAdj.find(
    (x) =>
      String(x.color || x.name || "").toLowerCase() ===
      String(colorName || "").toLowerCase(),
  );
  const s = sizeAdj.find(
    (x) => String(x.size || "").toLowerCase() === String(size || "").toLowerCase(),
  );
  if (c?.adjustment != null) price += Number(c.adjustment);
  if (s?.adjustment != null) price += Number(s.adjustment);
  return Math.max(0, price).toFixed(2);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface ColorVariantInput {
  colorName: string;
  colorHex: string;
  imageUrl?: string | null;
  extraImages?: { url: string; alt?: string }[];
  price: string;
  priceForSize?: (size: string) => string;
  compareAtForSize?: (size: string) => string | null;
  compareAtPrice?: string;
  baseSku: string;
  skuForSize?: (size: string) => string;
}

interface ProductMediaInput {
  originalSource: string;
  alt: string;
  mediaContentType: string;
}

/**
 * Gallery media: primary per color first (alt = pod-color:{name}), then extra scenes.
 */
function buildProductMedia(colorVariants: ColorVariantInput[]): ProductMediaInput[] {
  const seen = new Set<string>();
  const media: ProductMediaInput[] = [];
  const push = (url: string | null | undefined, alt: string) => {
    if (!url) return;
    const readable = ensureReadableUrl(url) || url;
    if (!readable || seen.has(readable)) return;
    seen.add(readable);
    media.push({
      originalSource: readable,
      alt,
      mediaContentType: "IMAGE",
    });
  };

  for (const v of colorVariants) {
    push(v.imageUrl, `pod-color:${v.colorName}`);
  }
  for (const v of colorVariants) {
    let i = 0;
    for (const extra of v.extraImages || []) {
      push(extra.url, extra.alt || `pod-extra:${v.colorName}:${i}`);
      i += 1;
    }
  }
  return media.slice(0, 20);
}

/** Poll until primary color media ids exist (do not wait for READY — attach ASAP). */
async function waitForColorMedia(
  adminGraphql: AdminGraphql,
  productId: string,
  colorNames: string[],
  maxAttempts = 12,
): Promise<Map<string, string>> {
  const needed = new Set(colorNames);
  let nodes: { alt?: string; status?: string; id?: string }[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const data = await gql<{
      product?: {
        media?: {
          nodes?: { alt?: string; status?: string; id?: string }[];
        };
      };
    }>(
      adminGraphql,
      `#graphql
      query productMedia($id: ID!) {
        product(id: $id) {
          media(first: 50) {
            nodes {
              alt
              status
              ... on MediaImage { id }
            }
          }
        }
      }`,
      { id: productId },
    );
    nodes = data.product?.media?.nodes || [];
    const byColor = new Map<string, string>();
    for (const n of nodes) {
      const alt = String(n.alt || "");
      if (!alt.startsWith("pod-color:") || !n.id) continue;
      if (n.status === "FAILED") continue;
      byColor.set(alt.slice("pod-color:".length), n.id);
    }
    if ([...needed].every((c) => byColor.has(c))) {
      return byColor;
    }
    await sleep(attempt < 3 ? 400 : 700);
  }

  const byColor = new Map<string, string>();
  for (const n of nodes) {
    const alt = String(n.alt || "");
    if (alt.startsWith("pod-color:") && n.id && n.status !== "FAILED") {
      byColor.set(alt.slice("pod-color:".length), n.id);
    }
  }
  return byColor;
}

interface MetafieldInput {
  namespace?: string;
  key: string;
  type: string;
  value: string;
}

async function setProductMetafields(
  adminGraphql: AdminGraphql,
  productId: string,
  metafields: MetafieldInput[],
): Promise<void> {
  const appOnly = metafields.filter(
    (m) => !m.namespace || m.namespace === "$app",
  );
  const googleFields = metafields.filter(
    (m) => m.namespace === "mm-google-shopping",
  );
  const payloads: {
    ownerId: string;
    namespace: string;
    key: string;
    type: string;
    value: string;
  }[] = [];
  for (const m of appOnly) {
    payloads.push({
      ownerId: productId,
      namespace: "$app",
      key: m.key,
      type: m.type,
      value: m.value,
    });
    payloads.push({
      ownerId: productId,
      namespace: "pod",
      key: m.key,
      type: m.type,
      value: m.value,
    });
  }
  for (const m of googleFields) {
    payloads.push({
      ownerId: productId,
      namespace: m.namespace!,
      key: m.key,
      type: m.type,
      value: m.value,
    });
  }
  if (!payloads.length) return;
  try {
    const res = await gql<{
      metafieldsSet?: {
        userErrors?: { field?: string[]; message: string }[];
      };
    }>(
      adminGraphql,
      `#graphql
      mutation setMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }`,
      { metafields: payloads },
    );
    if (res.metafieldsSet?.userErrors?.length) {
      console.warn("metafieldsSet:", res.metafieldsSet.userErrors);
    }
  } catch (err) {
    console.warn(
      "metafieldsSet failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

interface ExistingProduct {
  id: string;
  handle: string;
  variants?: {
    nodes?: {
      id: string;
      inventoryItem?: { id: string; tracked?: boolean };
    }[];
  };
}

async function fetchProductById(
  adminGraphql: AdminGraphql,
  id: string | null,
): Promise<ExistingProduct | null> {
  if (!id) return null;
  const data = await gql<{ product?: ExistingProduct | null }>(
    adminGraphql,
    `#graphql
    query productById($id: ID!) {
      product(id: $id) {
        id
        handle
        variants(first: 100) {
          nodes {
            id
            inventoryItem { id tracked }
          }
        }
      }
    }`,
    { id },
  );
  return data.product || null;
}

/** Update title/description/metafields/inventory policy — no new product (avoids -1 duplicates). */
async function updateShopifyProduct(
  adminGraphql: AdminGraphql,
  existing: ExistingProduct,
  {
    title,
    description,
    vendor,
    productType,
    tags,
    metafields,
    productStatus = "ACTIVE",
  }: {
    title: string;
    description: string;
    vendor: string;
    productType: string;
    tags: string[];
    metafields: MetafieldInput[];
    productStatus?: string;
  },
): Promise<{ id: string; handle: string }> {
  const updated = await gql<{
    productUpdate?: {
      product?: { id: string; handle: string };
      userErrors?: { message: string }[];
    };
  }>(
    adminGraphql,
    `#graphql
    mutation updatePodProduct($product: ProductUpdateInput!) {
      productUpdate(product: $product) {
        product { id handle }
        userErrors { field message }
      }
    }`,
    {
      product: {
        id: existing.id,
        title,
        descriptionHtml: description || "",
        vendor: vendor || "MyStore",
        productType,
        tags: tags || [],
        status: productStatus === "DRAFT" ? "DRAFT" : "ACTIVE",
      },
    },
  );
  if (updated.productUpdate?.userErrors?.length) {
    throw new Error(
      updated.productUpdate.userErrors.map((e) => e.message).join("; "),
    );
  }

  await setProductMetafields(adminGraphql, existing.id, metafields);

  const variantNodes = existing.variants?.nodes || [];
  if (variantNodes.length) {
    const bulk = await gql<{
      productVariantsBulkUpdate?: {
        userErrors?: { message: string }[];
      };
    }>(
      adminGraphql,
      `#graphql
      mutation fixVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          userErrors { field message }
        }
      }`,
      {
        productId: existing.id,
        variants: variantNodes.map((v) => ({
          id: v.id,
          inventoryPolicy: "CONTINUE",
          inventoryItem: { tracked: false },
        })),
      },
    );
    if (bulk.productVariantsBulkUpdate?.userErrors?.length) {
      console.warn(
        "Variant inventory update:",
        bulk.productVariantsBulkUpdate.userErrors,
      );
    }
  }

  return updated.productUpdate!.product!;
}

/**
 * Create or update one Shopify product for a design + garment template.
 * Pass existingProductGid to update in place (prevents handle-1 duplicates on re-sync).
 */
async function upsertShopifyProduct(
  adminGraphql: AdminGraphql,
  {
    existingProductGid,
    title,
    description,
    vendor,
    productType,
    tags,
    sizes,
    colorVariants,
    metafields,
    productStatus = "ACTIVE",
  }: {
    existingProductGid: string | null;
    title: string;
    description: string;
    vendor: string;
    productType: string;
    tags: string[];
    sizes: string[];
    colorVariants: ColorVariantInput[];
    metafields: MetafieldInput[];
    productStatus?: string;
  },
): Promise<{ id: string; handle: string }> {
  if (existingProductGid) {
    const existing = await fetchProductById(adminGraphql, existingProductGid);
    if (existing) {
      console.log(`[shopify-sync] Updating existing ${existing.handle}`);
      return updateShopifyProduct(adminGraphql, existing, {
        title,
        description,
        vendor,
        productType,
        tags,
        metafields,
        productStatus,
      });
    }
    console.log(
      `[shopify-sync] Linked product missing (${existingProductGid}) — creating new`,
    );
  }
  return createShopifyProduct(adminGraphql, {
    title,
    description,
    vendor,
    productType,
    tags,
    sizes,
    colorVariants,
    metafields,
    productStatus,
  });
}

/**
 * Create one Shopify product for a design + garment template.
 * Color is option #1 (Group by Color); variants get mediaId + untracked inventory (POD).
 */
async function createShopifyProduct(
  adminGraphql: AdminGraphql,
  {
    title,
    description,
    vendor,
    productType,
    tags,
    sizes,
    colorVariants,
    metafields,
    productStatus = "ACTIVE",
  }: {
    title: string;
    description: string;
    vendor: string;
    productType: string;
    tags: string[];
    sizes: string[];
    colorVariants: ColorVariantInput[];
    metafields: MetafieldInput[];
    productStatus?: string;
  },
): Promise<{ id: string; handle: string }> {
  const colors = colorVariants.map((v) => v.colorName);
  const media = buildProductMedia(colorVariants);

  const createData = await gql<{
    productCreate?: {
      product?: { id: string; handle: string };
      userErrors?: { message: string }[];
    };
  }>(
    adminGraphql,
    `#graphql
    mutation createPodProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
      productCreate(product: $product, media: $media) {
        product {
          id
          handle
          options {
            id
            name
            position
            optionValues { id name }
          }
        }
        userErrors { field message }
      }
    }`,
    {
      product: {
        title,
        descriptionHtml: description || "",
        vendor: vendor || "MyStore",
        productType,
        tags: tags || [],
        status: productStatus === "DRAFT" ? "DRAFT" : "ACTIVE",
        productOptions: [
          {
            name: "Color",
            values: colors.map((c) => ({ name: c })),
          },
          {
            name: "Size",
            values: sizes.map((s) => ({ name: s })),
          },
        ],
        metafields: metafields
          .filter((m) => !m.namespace || m.namespace === "$app")
          .map((m) => ({
            namespace: m.namespace || "$app",
            key: m.key,
            type: m.type,
            value: m.value,
          })),
      },
      media,
    },
  );

  const errs = createData.productCreate?.userErrors;
  if (errs?.length) {
    throw new Error(errs.map((e) => e.message).join("; "));
  }

  const product = createData.productCreate!.product!;
  await setProductMetafields(adminGraphql, product.id, metafields);

  const colorMediaIds = await waitForColorMedia(adminGraphql, product.id, colors);

  const variantInputs: Record<string, unknown>[] = [];
  for (const color of colorVariants) {
    const mediaId = colorMediaIds.get(color.colorName) || null;
    for (const size of sizes) {
      const price =
        typeof color.priceForSize === "function"
          ? color.priceForSize(size)
          : color.price;
      const sku = color.skuForSize
        ? color.skuForSize(size)
        : `${color.baseSku}-${size}`;
      const input: Record<string, unknown> = {
        optionValues: [
          { optionName: "Color", name: color.colorName },
          { optionName: "Size", name: size },
        ],
        price,
        inventoryPolicy: "CONTINUE",
        inventoryItem: {
          sku,
          tracked: false,
        },
      };
      if (mediaId) input.mediaId = mediaId;
      const compareAt =
        typeof color.compareAtForSize === "function"
          ? color.compareAtForSize(size)
          : color.compareAtPrice;
      if (compareAt) input.compareAtPrice = compareAt;
      variantInputs.push(input);
    }
  }

  const bulk = await gql<{
    productVariantsBulkCreate?: {
      userErrors?: { message: string }[];
    };
  }>(
    adminGraphql,
    `#graphql
    mutation bulkVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
      productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
        productVariants {
          id
          price
          inventoryItem { sku tracked }
          media(first: 1) {
            nodes {
              alt
              ... on MediaImage { id }
            }
          }
        }
        userErrors { field message }
      }
    }`,
    {
      productId: product.id,
      variants: variantInputs,
      strategy: "REMOVE_STANDALONE_VARIANT",
    },
  );

  if (bulk.productVariantsBulkCreate?.userErrors?.length) {
    const variantErrs = bulk.productVariantsBulkCreate.userErrors;
    console.warn("Variant errors:", variantErrs);
    throw new Error(variantErrs.map((e) => e.message).join("; "));
  }

  const missing = colors.filter((c) => !colorMediaIds.has(c));
  if (missing.length) {
    console.warn(
      `Variant images missing for colors (media not ready): ${missing.join(", ")}`,
    );
  }

  return product;
}

type BatchItemWithRelations = BatchItem & {
  template: (Template & { pricingConfig: PricingConfig | null }) | null;
  variant: Variant | null;
  scene: VariantScene | null;
};

type SyncTask = {
  designSku: string;
  groupId: string;
  templateId: string;
  template: Template & { pricingConfig: PricingConfig | null };
  items: BatchItemWithRelations[];
  typeKey: string;
  title: string;
  sizes: string[];
  colorVariants: ColorVariantInput[];
  tags: string[];
  description: string;
  existingProductGid: string | null;
};

interface CreatedProductSummary {
  id: string;
  handle: string;
  type: string;
  typeKey: string;
  title: string;
  thumbnail: string | null;
  priceFrom?: string;
  category: string | null;
}

/**
 * After mockups are ready: create one product per (designSku × template), then link metafields.
 * Products are created in parallel (POD_SYNC_CONCURRENCY, default 5).
 */
export async function syncJobToShopify(
  jobId: string,
  shop: string,
  accessToken: string,
): Promise<void> {
  const adminGraphql = createAdminGraphql(shop, accessToken);

  const job = await prisma.batchJob.findUnique({
    where: { id: jobId },
    include: {
      pricingConfig: true,
      items: {
        where: { status: "completed" },
        include: {
          template: { include: { pricingConfig: true } },
          variant: true,
          scene: true,
        },
      },
    },
  });

  if (!job) throw new Error("Job not found");

  await prisma.batchJob.update({
    where: { id: jobId },
    data: { shopifySyncStatus: "syncing" },
  });

  try {
    const settings = await prisma.shopSettings.findUnique({
      where: { shop: job.shop },
    });
    const vendor = settings?.vendor || "MyStore";
    const shopDefaultSizes = parseJson<string[]>(settings?.defaultSizes, DEFAULT_SIZES);
    const compareAtPercent = Number(settings?.compareAtPercent || 0);
    const productStatus =
      job.createAsDraft || settings?.defaultProductStatus === "DRAFT"
        ? "DRAFT"
        : "ACTIVE";

    const byDesign = new Map<string, Map<string, BatchItemWithRelations[]>>();
    for (const item of job.items) {
      if (!item.templateId || !item.template || !item.resultUrl) continue;
      if (!byDesign.has(item.sku)) byDesign.set(item.sku, new Map());
      const byTpl = byDesign.get(item.sku)!;
      if (!byTpl.has(item.templateId)) byTpl.set(item.templateId, []);
      byTpl.get(item.templateId)!.push(item);
    }

    const tasks: SyncTask[] = [];

    for (const [designSku, byTpl] of byDesign) {
      const existingLinks = await prisma.shopifyProductLink.findMany({
        where: { shop: job.shop, designSku },
      });
      const groupId = existingLinks[0]?.groupId || randomUUID();
      const linkByType = new Map(
        existingLinks.map((l) => [l.productTypeKey, l]),
      );

      for (const [templateId, rawItems] of byTpl) {
        const template = rawItems[0].template!;
        const items = rawItems.filter(
          (i) =>
            i.templateId === templateId &&
            i.template?.id === templateId &&
            i.resultUrl,
        );
        if (!items.length) continue;

        const pricing = template.pricingConfig || job.pricingConfig || null;
        const pricingSizes = parseJson<PriceAdjustment[]>(pricing?.sizeAdjustments, [])
          .map((s) => s.size)
          .filter((s): s is string => Boolean(s));
        const sizes =
          pricingSizes.length > 0 ? pricingSizes : shopDefaultSizes;
        const typeBase =
          template.basePrice ?? pricing?.basePrice ?? 19.99;

        const typeKey = productTypeKey(template.productType);
        const title = titleForProductType(
          items[0].title,
          template.productType,
        );

        const byColor = new Map<
          string,
          {
            colorName: string;
            colorHex: string;
            items: BatchItemWithRelations[];
          }
        >();
        for (const item of items) {
          const colorName = item.variant?.name || "Default";
          if (!byColor.has(colorName)) {
            byColor.set(colorName, {
              colorName,
              colorHex: item.variant?.colorHex || "#FFFFFF",
              items: [],
            });
          }
          byColor.get(colorName)!.items.push(item);
        }

        const colorVariants: ColorVariantInput[] = [];
        for (const [, group] of byColor) {
          const sorted = [...group.items].sort((a, b) => {
            const ap = a.scene?.isPrimary ? 0 : 1;
            const bp = b.scene?.isPrimary ? 0 : 1;
            if (ap !== bp) return ap - bp;
            return (a.scene?.sortOrder || 0) - (b.scene?.sortOrder || 0);
          });
          const primary = sorted[0];
          const extras = sorted.slice(1).map((i) => ({
            url: i.resultUrl!,
            alt: `pod-extra:${group.colorName}:${i.sceneName || ""}`,
          }));
          const baseSku = `${designSku}-${typeKey.toUpperCase()}-${colorCode(group.colorName)}`;
          const priceForSize = (size: string) =>
            computePrice(typeBase, group.colorName, size, pricing);

          colorVariants.push({
            colorName: group.colorName,
            colorHex: group.colorHex,
            imageUrl: primary?.resultUrl,
            extraImages: extras,
            price: priceForSize(sizes[0]),
            priceForSize,
            compareAtForSize: (size: string) => {
              if (!(compareAtPercent > 0)) return null;
              const p = Number(priceForSize(size));
              return (p * (1 + compareAtPercent / 100)).toFixed(2);
            },
            baseSku,
            skuForSize: (size: string) => `${baseSku}-${size}`,
          });
        }

        if (!colorVariants.some((c) => c.imageUrl)) {
          console.warn(
            `Skip sync ${designSku} / ${template.productType}: no mockup URLs`,
          );
          continue;
        }

        tasks.push({
          designSku,
          groupId,
          templateId,
          template,
          items,
          typeKey,
          title,
          sizes,
          colorVariants,
          tags: parseJson<string[]>(items[0].tags, []),
          description: descriptionForProduct(items[0].description || ""),
          existingProductGid: linkByType.get(typeKey)?.shopifyProductGid || null,
        });
      }
    }

    console.log(
      `[shopify-sync] Upserting ${tasks.length} products (concurrency=${SYNC_CONCURRENCY})`,
    );

    const createdList = await mapPool(
      tasks,
      async (task) => {
        const {
          designSku,
          groupId,
          templateId,
          template,
          items,
          typeKey,
          title,
          sizes,
          colorVariants,
          tags,
          description,
          existingProductGid,
        } = task;

        const product = await upsertShopifyProduct(adminGraphql, {
          existingProductGid,
          title,
          description,
          vendor,
          productType: template.productType,
          tags,
          sizes,
          colorVariants,
          productStatus,
          metafields: [
            {
              key: "design_sku",
              type: "single_line_text_field",
              value: designSku,
            },
            {
              key: "product_type_key",
              type: "single_line_text_field",
              value: typeKey,
            },
            {
              key: "category",
              type: "single_line_text_field",
              value: template.category || "unisex",
            },
            {
              key: "group_id",
              type: "single_line_text_field",
              value: groupId,
            },
            {
              key: "color_map",
              type: "json",
              value: JSON.stringify(
                colorVariants.map((c) => ({
                  name: c.colorName,
                  hex: c.colorHex,
                  image: c.imageUrl,
                  productType: template.productType,
                })),
              ),
            },
            ...buildGoogleShoppingMetafields({
              productType: template.productType,
              category: template.category,
              mpn: designSku,
            }),
          ],
        });

        const thumb =
          colorVariants.find((c) => c.imageUrl)?.imageUrl || null;

        await prisma.shopifyProductLink.upsert({
          where: {
            shop_designSku_productTypeKey: {
              shop: job.shop,
              designSku,
              productTypeKey: typeKey,
            },
          },
          create: {
            shop: job.shop,
            batchJobId: jobId,
            templateId,
            designSku,
            groupId,
            productTypeKey: typeKey,
            category: template.category,
            shopifyProductGid: product.id,
            shopifyHandle: product.handle,
            thumbnailUrl: thumb,
          },
          update: {
            groupId,
            shopifyProductGid: product.id,
            shopifyHandle: product.handle,
            thumbnailUrl: thumb,
            batchJobId: jobId,
          },
        });

        await prisma.batchItem.updateMany({
          where: { id: { in: items.map((i) => i.id) } },
          data: { shopifyProductId: product.id },
        });

        return {
          designSku,
          groupId,
          created: {
            id: product.id,
            handle: product.handle,
            type: template.productType,
            typeKey,
            title,
            thumbnail: thumb,
            priceFrom: colorVariants[0]?.price,
            category: template.category,
          } satisfies CreatedProductSummary,
        };
      },
      SYNC_CONCURRENCY,
    );

    const byGroup = new Map<string, CreatedProductSummary[]>();
    for (const row of createdList) {
      if (!row?.created) continue;
      if (!byGroup.has(row.designSku)) byGroup.set(row.designSku, []);
      byGroup.get(row.designSku)!.push(row.created);
    }

    const relatedJobs: { ownerId: string; relatedJson: string }[] = [];
    for (const [, products] of byGroup) {
      const relatedJson = JSON.stringify(
        products.map((p) => ({
          id: p.id,
          handle: p.handle,
          type: p.type,
          typeKey: p.typeKey,
          title: p.title,
          thumbnail: p.thumbnail,
          priceFrom: p.priceFrom,
          category: p.category,
        })),
      );
      for (const p of products) {
        relatedJobs.push({ ownerId: p.id, relatedJson });
      }
    }

    await mapPool(
      relatedJobs,
      async ({ ownerId, relatedJson }) => {
        await gql(
          adminGraphql,
          `#graphql
          mutation setRelated($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              userErrors { field message }
            }
          }`,
          {
            metafields: [
              {
                ownerId,
                namespace: "$app",
                key: "related_products",
                type: "json",
                value: relatedJson,
              },
              {
                ownerId,
                namespace: "pod",
                key: "related_products",
                type: "json",
                value: relatedJson,
              },
            ],
          },
        );
      },
      SYNC_CONCURRENCY,
    );

    await prisma.batchJob.update({
      where: { id: jobId },
      data: { shopifySyncStatus: "synced", errorMessage: null },
    });
  } catch (err) {
    await prisma.batchJob.update({
      where: { id: jobId },
      data: {
        shopifySyncStatus: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
