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
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white text-xs font-bold">
              PP
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-tight leading-none">
                POD Pro
              </span>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mt-1">
                Commerce ops
              </span>
            </span>
          </Link>
          <p className="mt-3 text-xs text-muted truncate" title={user.email}>
            {user.email}
          </p>
        </div>

        <AppNav />

        <div className="px-4 py-4 border-t border-border space-y-3">
          <ShopSwitcher
            shops={shops.map((s) => ({ shop: s.shop }))}
            activeShop={shop}
          />
          <Link
            href="/whats-new"
            className="block text-xs text-muted hover:text-foreground"
          >
            What’s new
          </Link>
          <a
            href={`mailto:support@example.com?subject=POD%20Pro%20help&body=Shop:%20${encodeURIComponent(shop || "")}%0AEmail:%20${encodeURIComponent(user.email || "")}`}
            className="block text-xs text-muted hover:text-foreground"
          >
            Contact support
          </a>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-border bg-white px-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {shop ?? "No store selected"}
            </p>
            <p className="text-xs text-muted truncate">
              Active store · switch in the sidebar
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/storefront"
              className="hidden sm:inline-flex rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background"
            >
              Storefront guide
            </Link>
            <Link
              href="/batches/new"
              prefetch
              className="rounded-lg bg-accent hover:bg-accent-hover text-white px-3 py-1.5 text-sm font-medium"
            >
              New batch
            </Link>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
