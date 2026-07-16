import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type SessionData = {
  userId?: string;
  email?: string;
  activeShop?: string;
};

const FOURTEEN_DAYS = 60 * 60 * 24 * 14;

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "pod_pro_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: FOURTEEN_DAYS,
    path: "/",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }
  return {
    userId: session.userId,
    email: session.email,
    activeShop: session.activeShop,
  };
}

export async function setSessionUser(userId: string, email: string) {
  const session = await getSession();
  session.userId = userId;
  session.email = email;
  await session.save();
}

export async function clearSession() {
  const session = await getSession();
  session.destroy();
}

export async function setActiveShop(shop: string | undefined) {
  const session = await getSession();
  if (shop === undefined) {
    delete session.activeShop;
  } else {
    session.activeShop = shop;
  }
  await session.save();
}
