import { describe, expect, it } from "vitest";
import { parseProductImport } from "./product-import";

const csv = (lines: string[]) => lines.join("\n");

describe("parseProductImport", () => {
  it("parses a full row into kobo, lists and stock", () => {
    const r = parseProductImport(csv([
      "Slug,Name,Category,Price,Compare at price,Tags,Warranty months,Visible,Stock Lagos,Image URLs,Features",
      'neck-fan,Neck Fan,smart-gadgets,"₦11,500",19000,fan|summer,6,yes,25,https://cdn.example.com/a.jpg|https://cdn.example.com/b.png,"Quiet: 3 speeds | Battery: 8 hours"',
    ]));
    expect(r.fileErrors).toEqual([]);
    expect(r.rows[0]).toEqual({
      line: 2,
      slug: "neck-fan",
      errors: [],
      values: {
        name: "Neck Fan", categorySlug: "smart-gadgets", priceKobo: 1_150_000, compareAtKobo: 1_900_000, tags: ["fan", "summer"],
        warrantyMonths: 6, isActive: true, stock: { lagos: 25 },
        imageUrls: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.png"],
        features: [{ title: "Quiet", description: "3 speeds" }, { title: "Battery", description: "8 hours" }],
      },
    });
  });

  it("leaves empty cells out so they don't overwrite existing values", () => {
    const r = parseProductImport(csv(["slug,name,price", "neck-fan,,12000"]));
    expect(r.rows[0]!.values).toEqual({ priceKobo: 1_200_000 });
  });

  it("reports row problems with the line number, and duplicate slugs", () => {
    const r = parseProductImport(csv(["slug,price,visible,image_urls,compare_at_price", "Bad Slug,abc,maybe,http://x.com/a.jpg,", "ok,100,yes,,90", "ok,200,,,"]));
    expect(r.rows[0]!.errors).toEqual([
      expect.stringContaining("lowercase letters"),
      expect.stringContaining("not a naira amount"),
      expect.stringContaining("yes or no"),
      expect.stringContaining("https://"),
    ]);
    expect(r.rows[1]!.errors).toEqual(["compare_at_price must be higher than price."]);
    expect(r.rows[2]!.errors).toEqual(['slug "ok" is already used on line 3.']);
  });

  it("rejects files without a slug column or rows, and lists unknown columns", () => {
    expect(parseProductImport("name\nX").fileErrors[0]).toContain('"slug"');
    expect(parseProductImport("slug\n").fileErrors[0]).toContain("no product rows");
    expect(parseProductImport("slug,colour\na,red").ignoredColumns).toEqual(["colour"]);
  });

  it("caps the number of rows", () => {
    const r = parseProductImport(["slug", ...Array.from({ length: 501 }, (_, i) => `p-${i}`)].join("\n"));
    expect(r.fileErrors[0]).toContain("At most 500");
  });

  it("undoes the export's formula guard so exported text round-trips", () => {
    const r = parseProductImport(csv(["slug,short_description", "a,'-30% lighter than V1"]));
    expect(r.rows[0]!.values.shortDescription).toBe("-30% lighter than V1");
  });
});
