import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { MAX_UPLOAD_BYTES, sniffImageType } from "../adapters/storage";

/**
 * Downloads a product photo from an https link given in a CSV import, so the shop serves its own copy.
 * Admin-only, but still guarded: https only, public IPs only (checked on every redirect hop), 5 MB cap
 * while streaming, 15 s timeout, and the bytes must really be JPG/PNG/WebP.
 */

export type RemoteImage = { ok: true; data: Buffer; type: string } | { ok: false; error: string };

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s.startsWith("::ffff:")) return isPrivateAddress(s.slice(7));
    return s === "::" || s === "::1" || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe8") || s.startsWith("fe9") ||
      s.startsWith("fea") || s.startsWith("feb") || s.startsWith("ff");
  }
  return true;
}

interface Deps {
  fetch: typeof fetch;
  resolve: (host: string) => Promise<string[]>;
}

const defaultDeps: Deps = {
  fetch: (...a) => fetch(...a),
  resolve: async (host) => (await lookup(host, { all: true })).map((r) => r.address),
};

export async function fetchRemoteImage(url: string, deps: Deps = defaultDeps): Promise<RemoteImage> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    let u: URL;
    try {
      u = new URL(current);
    } catch {
      return { ok: false, error: "not a valid link" };
    }
    if (u.protocol !== "https:" || u.username || u.password) return { ok: false, error: "only https:// photo links are allowed" };
    const host = u.hostname.replace(/^\[|\]$/g, "");
    let addresses: string[];
    try {
      addresses = isIP(host) ? [host] : await deps.resolve(host);
    } catch {
      return { ok: false, error: `couldn't find ${host}` };
    }
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) return { ok: false, error: "that address isn't a public website" };

    let res: Response;
    try {
      res = await deps.fetch(u, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { accept: "image/*" } });
    } catch {
      return { ok: false, error: "the photo link didn't respond" };
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return { ok: false, error: "the photo link redirects nowhere" };
      current = new URL(next, u).toString();
      continue;
    }
    if (!res.ok || !res.body) return { ok: false, error: `the photo link returned ${res.status}` };
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_UPLOAD_BYTES) return { ok: false, error: "photo is larger than 5 MB" };

    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        return { ok: false, error: "photo is larger than 5 MB" };
      }
      chunks.push(value);
    }
    const data = Buffer.concat(chunks);
    const type = sniffImageType(data);
    if (!type) return { ok: false, error: "the link isn't a JPG, PNG or WebP photo" };
    return { ok: true, data, type };
  }
  return { ok: false, error: "the photo link redirects too many times" };
}
