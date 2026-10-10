import { describe, expect, it } from "vitest";
import { fetchRemoteImage, isPrivateAddress, type RemoteResponse } from "./remote-image";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const reply = (status: number, body: Buffer | string = "", extra: { location?: string; contentLength?: number } = {}): RemoteResponse => {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body);
  return {
    status,
    location: extra.location ?? null,
    contentLength: extra.contentLength ?? bytes.length,
    body: (async function* () { yield bytes; })(),
    destroy: () => undefined,
  };
};
const ok = (body: Buffer | string) => reply(200, body);
const deps = (resp: (url: string) => RemoteResponse, ips: Record<string, string[]> = {}, used: string[] = []) => ({
  get: async (u: URL, address: string) => {
    used.push(address);
    return resp(String(u));
  },
  resolve: async (h: string) => ips[h] ?? ["93.184.216.34"],
});

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1", "0.0.0.0"])("%s is private", (ip) =>
    expect(isPrivateAddress(ip)).toBe(true));
  it.each(["93.184.216.34", "8.8.8.8", "2606:4700::1111"])("%s is public", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe("fetchRemoteImage", () => {
  it("downloads a real image from a public https host", async () => {
    const used: string[] = [];
    const r = await fetchRemoteImage("https://cdn.example.com/a.png", deps(() => ok(PNG), {}, used));
    expect(r).toEqual({ ok: true, data: PNG, type: "image/png" });
    expect(used, "must connect to the IP that was checked, not look the name up again").toEqual(["93.184.216.34"]);
  });
  it("refuses http, internal hosts and redirects into the private network", async () => {
    expect(await fetchRemoteImage("http://cdn.example.com/a.png", deps(() => ok(PNG)))).toMatchObject({ ok: false });
    expect(await fetchRemoteImage("https://intranet.local/a.png", deps(() => ok(PNG), { "intranet.local": ["10.0.0.5"] }))).toMatchObject({ ok: false });
    expect(await fetchRemoteImage("https://169.254.169.254/latest", deps(() => ok(PNG)))).toMatchObject({ ok: false });
    const redirecting = deps((u) => (u.includes("cdn") ? reply(302, "", { location: "https://metadata.internal/x" }) : ok(PNG)), {
      "metadata.internal": ["169.254.169.254"],
    });
    expect(await fetchRemoteImage("https://cdn.example.com/a.png", redirecting)).toEqual({ ok: false, error: "that address isn't a public website" });
  });
  it("rejects non-images and files over 5 MB", async () => {
    expect(await fetchRemoteImage("https://cdn.example.com/x", deps(() => ok("<html>")))).toMatchObject({ ok: false, error: expect.stringContaining("JPG") });
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    expect(await fetchRemoteImage("https://cdn.example.com/x", deps(() => ok(big)))).toMatchObject({ ok: false, error: expect.stringContaining("5 MB") });
  });
});
