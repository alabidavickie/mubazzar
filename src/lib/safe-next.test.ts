import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeNext("/admin/orders?status=paid#top")).toBe("/admin/orders?status=paid#top");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "javascript:alert(1)", "", null, 42])("refuses %j", (v) =>
    expect(safeNext(v)).toBeNull());
});
