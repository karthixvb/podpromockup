import prisma from "@/lib/db";

export type OnboardingStep = {
  id: string;
  label: string;
  href: string;
  done: boolean;
  detail?: string;
};

export async function getOnboardingSteps(shop: string): Promise<{
  steps: OnboardingStep[];
  completed: number;
  total: number;
  ready: boolean;
}> {
  const [templates, sets, batches, settings, links] = await Promise.all([
    prisma.template.count({ where: { shop } }),
    prisma.templateSet.count({ where: { shop } }),
    prisma.batchJob.count({ where: { shop } }),
    prisma.shopSettings.findUnique({ where: { shop } }),
    prisma.shopifyProductLink.count({ where: { shop } }),
  ]);

  const hasLambda = Boolean(process.env.AWS_LAMBDA_COMPOSITE_URL);
  const hasS3 = Boolean(process.env.AWS_S3_BUCKET);
  const hasVendor = Boolean(settings?.vendor && settings.vendor !== "MyStore");

  const steps: OnboardingStep[] = [
    {
      id: "store",
      label: "Connect a Shopify store",
      href: "/stores",
      done: true,
      detail: shop,
    },
    {
      id: "templates",
      label: "Create garment templates",
      href: "/templates",
      done: templates > 0,
      detail: templates > 0 ? `${templates} template(s)` : "Add T-Shirt, Hoodie…",
    },
    {
      id: "sets",
      label: "Build a template set",
      href: "/template-sets",
      done: sets > 0,
      detail: sets > 0 ? `${sets} set(s)` : "Group garment types together",
    },
    {
      id: "settings",
      label: "Review shop defaults",
      href: "/settings",
      done: hasVendor || Boolean(settings),
      detail: "Vendor, sizes, draft/active",
    },
    {
      id: "processing",
      label: "Image processing ready",
      href: "/settings#health",
      done: hasLambda && hasS3,
      detail: hasLambda && hasS3 ? "Compose & storage configured" : "Contact admin if missing",
    },
    {
      id: "batch",
      label: "Run your first batch",
      href: "/batches/new",
      done: batches > 0,
      detail: batches > 0 ? `${batches} batch(es)` : "Upload designs JSON",
    },
    {
      id: "sync",
      label: "Sync products to Shopify",
      href: "/batches",
      done: links > 0,
      detail: links > 0 ? `${links} product link(s)` : "Sync after compose completes",
    },
    {
      id: "storefront",
      label: "Add storefront POD block",
      href: "/storefront",
      done: false,
      detail: "Theme editor · hide Color on POD only",
    },
  ];

  // Storefront can't be auto-detected reliably; mark done once products synced
  // and merchant can still revisit the guide.
  const storefront = steps.find((s) => s.id === "storefront");
  if (storefront && links > 0) {
    storefront.done = true;
    storefront.detail = "Guide available · verify on live product page";
  }

  const completed = steps.filter((s) => s.done).length;
  const ready = templates > 0 && sets > 0 && hasLambda && hasS3;

  return { steps, completed, total: steps.length, ready };
}
