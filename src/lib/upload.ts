import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { storeResultImage } from "./storage";
import { sanitizeFilePart } from "./pod";

export interface UploadableFile {
  name?: string;
  type?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function contentTypeFor(file: UploadableFile): string {
  if (file?.type) return file.type;
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return "image/png";
}

/**
 * Upload mockup blank image → public URL (S3 preferred).
 */
export async function uploadMockupImage(
  shop: string,
  sceneId: string,
  file: UploadableFile,
): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = sanitizeFilePart(file.name || "mockup.png");
  const objectKey = `templates/${sanitizeFilePart(shop)}/${sceneId}/${Date.now()}_${safeName}`;
  const contentType = contentTypeFor(file);

  if (process.env.AWS_S3_BUCKET) {
    return storeResultImage(objectKey, bytes, contentType);
  }

  const dir = process.env.LOCAL_RESULTS_DIR || "./storage/results";
  const fullPath = path.join(dir, objectKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, bytes);

  const base = process.env.PUBLIC_RESULTS_BASE_URL;
  if (!base) {
    throw new Error(
      "Image upload is not configured. Contact your app administrator to finish setup.",
    );
  }
  return `${base.replace(/\/$/, "")}/${objectKey}`;
}
