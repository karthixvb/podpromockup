import bcrypt from "bcryptjs";
import prisma from "@/lib/db";

const ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function registerUser(
  email: string,
  password: string,
  name?: string,
) {
  const normalized = email.toLowerCase().trim();
  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: {
      email: normalized,
      passwordHash,
      name: name?.trim() || null,
    },
  });
}

export async function loginUser(email: string, password: string) {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return user;
}
