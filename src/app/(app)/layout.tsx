import Link from "next/link";
import { Suspense } from "react";
import AppNav from "@/components/AppNav";
import LogoutButton from "@/components/LogoutButton";
import PageSkeleton from "@/components/PageSkeleton";
import ShopSwitcher from "@/components/ShopSwitcher";
import { getAppShopContext } from "@/lib/shop-context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, shops, shop } = await getAppShopContext();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 shrink-0 border-r border-border bg-white flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            POD Pro
          </Link>
          <p className="mt-1 text-xs text-muted truncate" title={user.email}>
            {user.email}
          </p>
        </div>

        <AppNav />

        <div className="px-4 py-4 border-t border-border space-y-3">
          <ShopSwitcher
            shops={shops.map((s) => ({ shop: s.shop }))}
            activeShop={shop}
          />
          <LogoutButton />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-border bg-white px-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {shop ?? "No store selected"}
            </p>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>
          <Link
            href="/batches/new"
            prefetch
            className="shrink-0 rounded-lg bg-accent hover:bg-accent-hover text-white px-3 py-1.5 text-sm font-medium"
          >
            New batch
          </Link>
        </header>
        <main className="flex-1 p-6">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
