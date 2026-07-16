"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/templates", label: "Templates" },
  { href: "/template-sets", label: "Template sets" },
  { href: "/pricing", label: "Pricing" },
  { href: "/batches", label: "Batches" },
  { href: "/settings", label: "Settings" },
  { href: "/stores", label: "Stores" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppNav() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const pending = pendingHref === item.href && !active;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={() => setPendingHref(item.href)}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-accent/10 text-accent"
                : pending
                  ? "bg-background text-foreground"
                  : "hover:bg-background"
            }`}
          >
            <span>{item.label}</span>
            {pending ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
