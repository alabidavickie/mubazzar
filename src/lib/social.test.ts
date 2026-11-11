import { describe, expect, it } from "vitest";
import { DEFAULT_SOCIAL, socialLinkList, socialLinkProblem } from "./social";
import { SETTING_SCHEMAS } from "./schemas/settings";

describe("social links", () => {
  it("accepts the owner's Facebook page and WhatsApp channel", () => {
    expect(socialLinkProblem("facebook", DEFAULT_SOCIAL.facebook)).toBeNull();
    expect(socialLinkProblem("whatsappChannel", DEFAULT_SOCIAL.whatsappChannel)).toBeNull();
    expect(socialLinkList(DEFAULT_SOCIAL).map((l) => l.label)).toEqual(["Facebook", "WhatsApp channel"]);
  });

  it("rejects other websites, lookalike hosts and plain http", () => {
    expect(socialLinkProblem("facebook", "https://evil.example/facebook.com")).toMatch(/doesn't look like a Facebook link/);
    expect(socialLinkProblem("facebook", "https://facebook.com.evil.example/x")).not.toBeNull();
    expect(socialLinkProblem("facebook", "http://www.facebook.com/page")).not.toBeNull();
    expect(socialLinkProblem("instagram", "javascript:alert(1)")).not.toBeNull();
    expect(socialLinkProblem("tiktok", "not a url")).toMatch(/full TikTok link/);
  });

  it("leaves empty fields out of the footer", () => {
    expect(socialLinkList({ facebook: "", instagram: "https://www.instagram.com/mubazzar/" }).map((l) => l.key)).toEqual(["instagram"]);
    expect(socialLinkList(null)).toEqual([]);
  });

  it("is validated when the admin saves it", () => {
    const ok = SETTING_SCHEMAS.social_links.safeParse({ ...DEFAULT_SOCIAL, instagram: "https://instagram.com/mubazzar" });
    expect(ok.success).toBe(true);
    const bad = SETTING_SCHEMAS.social_links.safeParse({ ...DEFAULT_SOCIAL, facebook: "https://example.com" });
    expect(bad.success).toBe(false);
    expect(bad.error!.issues[0]!.path).toEqual(["facebook"]);
  });
});
