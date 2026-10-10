import { describe, expect, it } from "vitest";
import { backTarget } from "./back-target";

describe("backTarget", () => {
  it("is hidden on section roots", () => {
    for (const p of ["/", "/admin", "/dispatch", "/admin/"]) expect(backTarget(p)).toBeNull();
  });

  it("sends storefront pages home and product/category pages to the shop", () => {
    expect(backTarget("/search")?.href).toBe("/");
    expect(backTarget("/deals")?.href).toBe("/");
    expect(backTarget("/lp/turbo-car-vacuum")?.href).toBe("/shop");
    expect(backTarget("/c/car-tech")?.href).toBe("/shop");
    expect(backTarget("/account/addresses")?.href).toBe("/account");
  });

  it("never points at a route that has no page", () => {
    expect(backTarget("/dispatch/abc")?.href).toBe("/dispatch");
  });

  it("walks up one level in the admin area", () => {
    expect(backTarget("/admin/orders")?.href).toBe("/admin");
    expect(backTarget("/admin/orders/abc")?.href).toBe("/admin/orders");
    expect(backTarget("/admin/orders/abc/print")).toMatchObject({ href: "/admin/orders/abc", label: "Back to order" });
    expect(backTarget("/admin/products/new")?.href).toBe("/admin/products");
    expect(backTarget("/admin/landing-pages/abc")?.href).toBe("/admin/landing-pages");
  });

  it("does not return to a submitted order form", () => {
    expect(backTarget("/order/0123456789abcdef0123456789abcdef")).toMatchObject({ href: "/", preferHistory: false });
  });
});
