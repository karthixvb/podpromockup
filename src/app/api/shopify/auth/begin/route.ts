import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { beginOAuth } from "@/lib/shopify";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    return await beginOAuth(request);
  } catch (err) {
    console.error("Shopify OAuth begin failed:", err);
    return NextResponse.redirect(new URL("/stores?error=oauth", request.url));
  }
}
