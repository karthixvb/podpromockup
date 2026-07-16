import prisma from "@/lib/db";

export async function logActivity(input: {
  shop: string;
  action: string;
  message: string;
  userId?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        shop: input.shop,
        action: input.action,
        message: input.message,
        userId: input.userId || null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
  } catch (err) {
    console.warn("[activity]", err);
  }
}
