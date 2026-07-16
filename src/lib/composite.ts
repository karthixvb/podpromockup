/**
 * Call AWS Lambda composite function (Sharp).
 * Returns PNG Buffer.
 */
export async function compositeViaLambda({
  mockupUrl,
  designUrl,
  cropRegion,
  align = "center",
  editorWidth = 600,
  editorHeight = 500,
}: {
  mockupUrl: string;
  designUrl: string;
  cropRegion?: { x: number; y: number; width: number; height: number };
  align?: string;
  editorWidth?: number;
  editorHeight?: number;
}): Promise<Buffer> {
  const lambdaUrl = process.env.AWS_LAMBDA_COMPOSITE_URL;
  if (!lambdaUrl) {
    throw new Error("AWS_LAMBDA_COMPOSITE_URL is not configured");
  }

  const res = await fetch(lambdaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mockup_url: mockupUrl,
      design_url: designUrl,
      crop_region: cropRegion || { x: 50, y: 50, width: 200, height: 250 },
      align,
      editor_width: editorWidth,
      editor_height: editorHeight,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    image_base64?: string;
    body?: string | { image_base64?: string };
  };

  if (!res.ok || data.error) {
    throw new Error(data.error || `Lambda composite failed: HTTP ${res.status}`);
  }

  const b64 =
    data.image_base64 ||
    (typeof data.body === "object" ? data.body?.image_base64 : undefined);
  if (!b64) {
    if (typeof data.body === "string") {
      const parsed = JSON.parse(data.body) as { image_base64?: string };
      if (parsed.image_base64) {
        return Buffer.from(parsed.image_base64, "base64");
      }
    }
    throw new Error("Lambda response missing image_base64");
  }

  return Buffer.from(b64, "base64");
}
