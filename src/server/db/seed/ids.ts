import { createHash } from "node:crypto";

/**
 * Deterministic UUIDv5-style ids for seed rows, so every fresh database (dev, build workers,
 * tests, Supabase seed) gets identical ids for the same seed entity.
 */
export function seedId(kind: string, key: string): string {
  const h = createHash("sha1").update(`mubazzar:${kind}:${key}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x50; // version 5
  h[8] = (h[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
