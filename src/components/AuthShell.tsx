"use client";

import Link from "next/link";
import { FormEvent, ReactNode } from "react";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex w-[42%] relative overflow-hidden items-end p-10 bg-[linear-gradient(160deg,#0b6e4f_0%,#0a4d3a_45%,#123047_100%)] text-white">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.12), transparent 35%)",
          }}
        />
        <div className="relative space-y-3 max-w-sm">
          <p className="text-sm font-medium tracking-[0.18em] uppercase opacity-80">
            POD Pro
          </p>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Multi-store print-on-demand, one workspace.
          </h2>
          <p className="text-sm opacity-85 leading-relaxed">
            Connect shops, compose mockups, sync products, and ship a polished
            storefront experience from a single admin.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <p className="text-sm font-semibold tracking-tight text-accent">
              POD Pro
            </p>
          </div>
          <div className="bg-panel border border-border rounded-xl p-8 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight mb-1">
              {title}
            </h1>
            <p className="text-muted text-sm mb-6">{subtitle}</p>
            {children}
          </div>
          {footer ? <div className="mt-4 text-center text-sm text-muted">{footer}</div> : null}
          <p className="mt-6 text-center text-xs text-muted">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            {" · "}
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export type { FormEvent };
