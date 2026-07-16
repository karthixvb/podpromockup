import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getSession, requireUser } from "@/lib/session";

export async function getShopConnections(userId: string) {
  return prisma.shopConnection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getActiveShopConnection(
  userId: string,
  activeShop?: string,
) {
  if (activeShop) {
    const owned = await prisma.shopConnection.findUnique({
      where: { userId_shop: { userId, shop: activeShop } },
    });
    if (owned) return owned;
  }

  return prisma.shopConnection.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function requireActiveShop() {
  const user = await requireUser();
  const connection = await getActiveShopConnection(
    user.userId,
    user.activeShop,
  );
  if (!connection) {
    redirect("/stores");
  }
  return { ...user, connection, shop: connection.shop };
}

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
