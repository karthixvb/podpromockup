import { createHmac, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function getSignatureKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmacSha256(`AWS4${secret}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function s3Config() {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_S3_REGION || "us-east-1";
  const accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY;
  const publicBase =
    process.env.AWS_S3_PUBLIC_BASE_URL ||
    (bucket ? `https://${bucket}.s3.${region}.amazonaws.com` : "");
  return { bucket, region, accessKeyId, secretAccessKey, publicBase };
}

/**
 * Extract object key from our S3 / CloudFront URLs.
 */
export function extractS3ObjectKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const { bucket, region, publicBase } = s3Config();

    if (bucket && u.hostname.startsWith(`${bucket}.s3.`)) {
      return decodeURIComponent(u.pathname.replace(/^\//, ""));
    }
    if (bucket && u.hostname === `s3.${region}.amazonaws.com`) {
      const parts = u.pathname.replace(/^\//, "").split("/");
      if (parts[0] === bucket) return decodeURIComponent(parts.slice(1).join("/"));
    }
    if (publicBase && url.startsWith(publicBase.replace(/\/$/, ""))) {
      return decodeURIComponent(
        url
          .slice(publicBase.replace(/\/$/, "").length)
          .replace(/^\//, "")
          .split("?")[0],
      );
    }
    if (u.hostname.includes(".amazonaws.com")) {
      return decodeURIComponent(u.pathname.replace(/^\//, "").split("?")[0]);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Presigned GET URL — works even when bucket is private (needed for browser + Lambda).
 */
export function createPresignedGetUrl(
  objectKey: string,
  expiresSeconds = 60 * 60 * 24 * 7,
): string {
  const { bucket, region, accessKeyId, secretAccessKey } = s3Config();
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 credentials not configured for signed URL");
  }

  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;

  const encodedKey = objectKey
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");

  const canonicalQuery = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(credential)}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-Expires=${expiresSeconds}`,
    `X-Amz-SignedHeaders=host`,
  ].join("&");

  const canonicalRequest = [
    "GET",
    `/${encodedKey}`,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, "s3");
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `https://${host}/${encodedKey}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/**
 * Turn a stored S3 URL into a browser/Lambda-readable URL (presign if private bucket).
 */
export function ensureReadableUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  if (url.includes("X-Amz-Signature=")) return url;
  const key = extractS3ObjectKey(url);
  if (!key || !process.env.AWS_S3_BUCKET) return url;
  try {
    return createPresignedGetUrl(key);
  } catch {
    return url;
  }
}

/**
 * Upload to S3.
 * Default ACL = public-read so browser / Shopify / Lambda can fetch the URL.
 * Set AWS_S3_ACL= (empty) in .env if bucket uses "Bucket owner enforced" (no ACLs).
 */
async function uploadToS3(
  objectKey: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const { bucket, region, accessKeyId, secretAccessKey, publicBase } = s3Config();
  const acl =
    process.env.AWS_S3_ACL === undefined || process.env.AWS_S3_ACL === null
      ? "public-read"
      : process.env.AWS_S3_ACL;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 credentials not configured");
  }

  const putOnce = async (useAcl: string) => {
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const endpoint = `https://${host}/${objectKey}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);
    const payloadHash = sha256Hex(body);

    const headerMap: Record<string, string> = {
      "content-type": contentType,
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (useAcl) headerMap["x-amz-acl"] = useAcl;

    const sortedKeys = Object.keys(headerMap).sort();
    const canonicalHeaders = sortedKeys.map((k) => `${k}:${headerMap[k]}\n`).join("");
    const signedHeaders = sortedKeys.join(";");
    const canonicalRequest = `PUT\n/${objectKey}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;
    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, "s3");
    const signature = createHmac("sha256", signingKey)
      .update(stringToSign, "utf8")
      .digest("hex");

    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const fetchHeaders: Record<string, string> = {
      "Content-Type": contentType,
      Host: host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authHeader,
    };
    if (useAcl) fetchHeaders["x-amz-acl"] = useAcl;

    const res = await fetch(endpoint, {
      method: "PUT",
      headers: fetchHeaders,
      body: new Uint8Array(body),
    });

    return { res, text: await res.text() };
  };

  let { res, text } = await putOnce(acl || "");
  if (
    !res.ok &&
    acl &&
    (text.includes("AccessControlListNotSupported") ||
      text.includes("The bucket does not allow ACLs"))
  ) {
    console.warn("[S3] Upload with ACL failed, retrying without ACL:", text.slice(0, 200));
    ({ res, text } = await putOnce(""));
    if (res.ok) {
      console.warn(
        "[S3] Uploaded WITHOUT public-read ACL. Check: Object Ownership = ACLs enabled + IAM s3:PutObjectAcl.",
      );
    }
  }

  if (!res.ok) {
    throw new Error(`S3 upload failed: ${res.status} ${text.slice(0, 400)}`);
  }

  return `${publicBase.replace(/\/$/, "")}/${objectKey}`;
}

async function uploadLocal(objectKey: string, body: Buffer): Promise<string> {
  const dir = process.env.LOCAL_RESULTS_DIR || "./storage/results";
  const fullPath = path.join(dir, objectKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, body);
  const base = process.env.PUBLIC_RESULTS_BASE_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}/${objectKey}`;
  }
  return `file://${path.resolve(fullPath).replace(/\\/g, "/")}`;
}

export async function storeResultImage(
  objectKey: string,
  buffer: Buffer,
  contentType = "image/png",
): Promise<string> {
  if (process.env.AWS_S3_BUCKET) {
    return uploadToS3(objectKey, buffer, contentType);
  }
  return uploadLocal(objectKey, buffer);
}
