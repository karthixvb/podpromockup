import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import ShopSwitcher from "@/components/ShopSwitcher";
import {
  getActiveShopConnection,
  getShopConnections,
} from "@/lib/shop-context";
import { requireUser } from "@/lib/session";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/templates", label: "Templates" },
  { href: "/template-sets", label: "Template sets" },
  { href: "/pricing", label: "Pricing" },
  { href: "/batches", label: "Batches" },
  { href: "/settings", label: "Settings" },
  { href: "/stores", label: "Stores" },
] as const;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const shops = await getShopConnections(user.userId);
  const active = await getActiveShopConnection(
    user.userId,
    user.activeShop,
  );
  const activeShop = active?.shop ?? null;

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

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-background"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-border space-y-3">
          <ShopSwitcher
            shops={shops.map((s) => ({ shop: s.shop }))}
            activeShop={activeShop}
          />
          <LogoutButton />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-border bg-white px-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {activeShop ?? "No store selected"}
            </p>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>
          <Link
            href="/batches/new"
            className="shrink-0 rounded-lg bg-accent hover:bg-accent-hover text-white px-3 py-1.5 text-sm font-medium"
          >
            New batch
          </Link>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
