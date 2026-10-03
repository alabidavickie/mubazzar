import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { projectRoot } from "../db/migrate";
import { env, services } from "../env";

export type Bucket = "product-images" | "private-proofs";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface StoredFile {
  /** Value to persist in the DB. Public buckets: an absolute/relative URL. Private: "private://<path>". */
  ref: string;
  path: string;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function validateImage(file: { type: string; size: number }): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return "Upload a JPG, PNG or WebP image";
  if (file.size > MAX_UPLOAD_BYTES) return "Image must be 5MB or smaller";
  if (file.size === 0) return "The file is empty";
  return null;
}

/** Checks magic bytes so a renamed script can't pass as an image. */
export function sniffImageType(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  return null;
}

function localDir(bucket: Bucket): string {
  return path.join(process.env.UPLOADS_DIR ?? path.join(projectRoot(), ".data", "uploads"), bucket);
}

export async function uploadImage(bucket: Bucket, folder: string, data: Buffer, contentType: string): Promise<StoredFile> {
  const sniffed = sniffImageType(data);
  if (!sniffed || sniffed !== contentType) throw new Error("INVALID_IMAGE");
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "").slice(0, 80) || "misc";
  const objectPath = `${safeFolder}/${randomUUID()}.${EXT[contentType]}`;

  if (services.supabaseStorage) {
    const res = await fetch(`${env.supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.supabaseServiceKey}`,
        "content-type": contentType,
        "x-upsert": "false",
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Storage upload failed: ${res.status}`);
    return bucket === "product-images"
      ? { ref: `${env.supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`, path: objectPath }
      : { ref: `private://${objectPath}`, path: objectPath };
  }

  const target = path.join(localDir(bucket), objectPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return bucket === "product-images"
    ? { ref: `/api/uploads/${bucket}/${objectPath}`, path: objectPath }
    : { ref: `private://${objectPath}`, path: objectPath };
}

/** Local-mock reader used by /api/uploads (public bucket) and the staff-only proof viewer. */
export async function readLocalObject(bucket: Bucket, objectPath: string): Promise<Buffer | null> {
  const base = localDir(bucket);
  const full = path.resolve(base, objectPath);
  if (!full.startsWith(path.resolve(base))) return null; // path traversal guard
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}

/** Short-lived URL for a private object (Supabase signed URL, or the auth-checked local route). */
export async function privateObjectUrl(ref: string): Promise<string | null> {
  if (!ref.startsWith("private://")) return ref;
  const objectPath = ref.slice("private://".length);
  if (services.supabaseStorage) {
    const res = await fetch(`${env.supabaseUrl}/storage/v1/object/sign/private-proofs/${objectPath}`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.supabaseServiceKey}`, "content-type": "application/json" },
      body: JSON.stringify({ expiresIn: 600 }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { signedURL?: string };
    return json.signedURL ? `${env.supabaseUrl}/storage/v1${json.signedURL}` : null;
  }
  return `/api/proofs/${objectPath}`;
}
