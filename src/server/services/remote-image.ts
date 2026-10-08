import "server-only";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP, type LookupFunction } from "node:net";
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

export interface RemoteResponse {
  status: number;
  location: string | null;
  contentLength: number;
  body: AsyncIterable<Uint8Array>;
  destroy: () => void;
}

interface Deps {
  resolve: (host: string) => Promise<string[]>;
  /** One HTTPS GET that connects to exactly `address` (no second DNS lookup, so the checked IP is the used IP). */
  get: (url: URL, address: string) => Promise<RemoteResponse>;
}

export const pinnedHttpsGet: Deps["get"] = (url, address) =>
    new Promise((resolve, reject) => {
      const family = isIP(address);
      // Connect to the address that passed the public-IP check; resolving the name again would let a hostile
      // DNS server answer "public" for the check and "internal" for the connection (DNS rebinding).
      const pinned = ((_host: string, opts: { all?: boolean }, cb: (...args: unknown[]) => void) =>
        opts.all ? cb(null, [{ address, family }]) : cb(null, address, family)) as unknown as LookupFunction;
      const req = request(url, { method: "GET", headers: { accept: "image/*", "user-agent": "MUBAZZAR-import/1.0" }, lookup: pinned, timeout: 15_000 }, (res) =>
        resolve({
          status: res.statusCode ?? 0,
          location: typeof res.headers.location === "string" ? res.headers.location : null,
          contentLength: Number(res.headers["content-length"] ?? 0),
          body: res,
          destroy: () => res.destroy(),
        }),
      );
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", reject);
      req.end();
    });

const defaultDeps: Deps = {
  resolve: async (host) => (await lookup(host, { all: true })).map((r) => r.address),
  get: pinnedHttpsGet,
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

    // Pin the first validated address; a multi-address host is fine because every address was checked.
    let res: RemoteResponse;
    try {
      res = await deps.get(u, addresses[0]!);
    } catch {
      return { ok: false, error: "the photo link didn't respond" };
    }
    if (res.status >= 300 && res.status < 400) {
      res.destroy();
      if (!res.location) return { ok: false, error: "the photo link redirects nowhere" };
      current = new URL(res.location, u).toString();
      continue;
    }
    if (res.status < 200 || res.status >= 300) {
      res.destroy();
      return { ok: false, error: `the photo link returned ${res.status}` };
    }
    if (res.contentLength > MAX_UPLOAD_BYTES) {
      res.destroy();
      return { ok: false, error: "photo is larger than 5 MB" };
    }

    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for await (const chunk of res.body) {
        size += chunk.byteLength;
        if (size > MAX_UPLOAD_BYTES) {
          res.destroy();
          return { ok: false, error: "photo is larger than 5 MB" };
        }
        chunks.push(chunk);
      }
    } catch {
      return { ok: false, error: "the photo download was interrupted" };
    }
    const data = Buffer.concat(chunks);
    const type = sniffImageType(data);
    if (!type) return { ok: false, error: "the link isn't a JPG, PNG or WebP photo" };
    return { ok: true, data, type };
  }
  return { ok: false, error: "the photo link redirects too many times" };
}
