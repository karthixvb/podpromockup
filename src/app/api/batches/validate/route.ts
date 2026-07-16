import { NextResponse } from "next/server";
import { parseDesignsJson } from "@/lib/pod";
import { getActiveShopForApi } from "@/lib/shop-context";

export async function POST(request: Request) {
  try {
    const ctx = await getActiveShopForApi();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const designsJson = String(body.designsJson || "");
    const parsed = parseDesignsJson(designsJson);
    if (!parsed.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error,
          rejected: parsed.rejected?.slice(0, 20),
          designs: [],
          totalRaw: parsed.totalRaw,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      error: null,
      designs: parsed.designs.map((d) => ({
        sku: d.sku,
        title: d.title,
        lightImageUrl: d.lightImageUrl,
        darkImageUrl: d.darkImageUrl,
      })),
      rejected: parsed.rejected,
      duplicateSkus: parsed.duplicateSkus,
      totalRaw: parsed.totalRaw,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validate failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
