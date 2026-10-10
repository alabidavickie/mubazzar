import { describe, expect, it } from "vitest";
import { internalBackLink } from "./referrer";

const HOST = "mubazzar.example";
const back = (referer: string | null, path = "/lp/turbo-car-vacuum") => internalBackLink(referer, HOST, path);

describe("internalBackLink", () => {
  it("links back to the page the visitor came from on this site", () => {
    expect(back(`https://${HOST}/shop?price=under15`)).toEqual({ href: "/shop?price=under15", label: "Back to Shop" });
    expect(back(`https://${HOST}/search?q=vacuum`)).toEqual({ href: "/search?q=vacuum", label: "Back to search results" });
    expect(back(`https://${HOST}/`)).toEqual({ href: "/", label: "Back to Home" });
    expect(back(`https://${HOST}/c/car-tech`)?.label).toBe("Back to category");
    expect(back(`https://${HOST}/privacy`)?.label).toBe("Back to previous page");
  });

  it("gives ad traffic no way out: off-site, missing or malformed referrers", () => {
    expect(back("https://l.facebook.com/l.php?u=abc")).toBeNull();
    expect(back(`https://${HOST}.evil.example/shop`)).toBeNull();
    expect(back(null)).toBeNull();
    expect(back("")).toBeNull();
    expect(back("not a url")).toBeNull();
    expect(internalBackLink(`https://${HOST}/shop`, null, "/lp/x")).toBeNull();
  });

  it("never links to private, transactional or staff pages", () => {
    for (const p of ["/order/0123456789abcdef0123456789abcdef", "/checkout", "/login?next=/x", "/admin/orders", "/dispatch", "/api/events"]) {
      expect(back(`https://${HOST}${p}`), p).toBeNull();
    }
  });

  it("never links to the page itself or to an off-site path", () => {
    expect(back(`https://${HOST}/lp/turbo-car-vacuum?utm_source=x`)).toBeNull();
    expect(back(`https://${HOST}//evil.example/x`)).toBeNull();
  });
});
