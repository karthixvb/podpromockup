import { requireUser } from "@/lib/session";
import { getShopConnections } from "@/lib/shop-context";
import StoresClient from "./StoresClient";

type SearchParams = Promise<{ connected?: string; error?: string }>;

export default async function StoresPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const connections = await getShopConnections(user.userId);
  const params = await searchParams;

  const stores = connections.map((c) => ({
    shop: c.shop,
    scope: c.scope,
    isActive: c.shop === user.activeShop,
  }));

  // If no active shop marked but stores exist, highlight the first as active for UI clarity
  if (!user.activeShop && stores.length > 0) {
    stores[0].isActive = true;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Stores</h1>
        <p className="mt-1 text-sm text-muted">
          Connect and manage your Shopify stores.
        </p>
      </header>
      <StoresClient
        stores={stores}
        connected={params.connected === "1"}
        error={params.error ?? null}
      />
    </div>
  );
}
