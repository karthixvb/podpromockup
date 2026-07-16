import { redirect } from "next/navigation";
import { cache } from "react";
import prisma from "@/lib/db";
import { getSession, requireUser } from "@/lib/session";

export const getShopConnections = cache(async (userId: string) => {
  return prisma.shopConnection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
});

/** One DB round-trip: all shops + resolved active connection. */
export const getAppShopContext = cache(async () => {
  const user = await requireUser();
  const shops = await getShopConnections(user.userId);

  let connection =
    user.activeShop != null
      ? shops.find((s) => s.shop === user.activeShop) ?? null
      : null;
  if (!connection) {
    connection = shops[0] ?? null;
  }

  return {
    user,
    shops,
    connection,
    shop: connection?.shop ?? null,
  };
});

export async function getActiveShopConnection(
  userId: string,
  activeShop?: string,
) {
  const shops = await getShopConnections(userId);
  if (activeShop) {
    const owned = shops.find((s) => s.shop === activeShop);
    if (owned) return owned;
  }
  return shops[0] ?? null;
}

export const requireActiveShop = cache(async () => {
  const ctx = await getAppShopContext();
  if (!ctx.connection) {
    redirect("/stores");
  }
  return {
    ...ctx.user,
    connection: ctx.connection,
    shop: ctx.connection.shop,
  };
});

/** API-safe: returns null instead of redirecting when unauthenticated / no shop. */
export async function getActiveShopForApi() {
  const session = await getSession();
  if (!session.userId) return null;
  const connection = await getActiveShopConnection(
    session.userId,
    session.activeShop,
  );
  if (!connection) return null;
  return {
    userId: session.userId,
    email: session.email,
    activeShop: session.activeShop,
    connection,
    shop: connection.shop,
  };
}

export async function ensureShopSettings(shop: string) {
  return prisma.shopSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });
}

export async function userOwnsShop(
  userId: string,
  shop: string,
): Promise<boolean> {
  const row = await prisma.shopConnection.findUnique({
    where: { userId_shop: { userId, shop } },
    select: { id: true },
  });
  return !!row;
}
