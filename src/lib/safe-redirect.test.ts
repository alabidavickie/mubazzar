import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("allows same-site paths with query and hash", () => {
    expect(safeRedirectPath("/admin")).toBe("/admin");
    expect(safeRedirectPath("/admin/orders?status=awaiting_chat#top")).toBe("/admin/orders?status=awaiting_chat#top");
  });

  it.each([
    ["absolute URL", "https://evil.com"],
    ["protocol-relative", "//evil.com"],
    ["backslash", "/\\evil.com"],
    ["encoded backslash already decoded", "/\\/evil.com"],
    ["tab trick", "/\t/evil.com"],
    ["newline trick", "/\n/evil.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["relative without slash", "evil.com"],
    ["empty", ""],
    ["non-string", 42],
  ])("rejects %s", (_name, value) => {
    expect(safeRedirectPath(value)).toBeNull();
  });
});
