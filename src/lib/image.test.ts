import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { IMAGE_DEVICE_SIZES, IMAGE_SIZES, optimizedImageProps } from "./image";

describe("optimizedImageProps", () => {
  it("stays in sync with next.config image sizes (the optimizer rejects other widths)", () => {
    expect(nextConfig.images?.deviceSizes).toEqual([...IMAGE_DEVICE_SIZES]);
    expect(nextConfig.images?.imageSizes).toEqual([...IMAGE_SIZES]);
  });

  it("builds a responsive srcset through /_next/image for fill images", () => {
    const p = optimizedImageProps({ src: "/images/products/a b.webp", alt: "A", fill: true, sizes: "100vw", loading: "eager" });
    expect(p.srcSet.split(", ")).toHaveLength(IMAGE_SIZES.length + IMAGE_DEVICE_SIZES.length);
    expect(p.srcSet).toContain("/_next/image?url=%2Fimages%2Fproducts%2Fa%20b.webp&w=390&q=75 390w");
    expect(p).toMatchObject({ sizes: "100vw", loading: "eager", decoding: "async", style: { position: "absolute" } });
    expect(p.width).toBeUndefined();
  });

  it("uses 1x/2x density for fixed-size images", () => {
    const p = optimizedImageProps({ src: "/brand/emblem.webp", alt: "", width: 28, height: 28 });
    expect(p.srcSet).toBe("/_next/image?url=%2Fbrand%2Femblem.webp&w=48&q=75 1x, /_next/image?url=%2Fbrand%2Femblem.webp&w=64&q=75 2x");
    expect(p).toMatchObject({ width: 28, height: 28, loading: "lazy", sizes: undefined });
  });
});
