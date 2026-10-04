/**
 * Builds <img> props that use Next's image optimizer (/_next/image — AVIF/WebP, resized, cached)
 * without importing `next/image`. Importing `next/image` (even just getImageProps) registers its
 * client component and ships its runtime; the ad landing page can't afford that JS.
 * Widths must stay in sync with `images.deviceSizes` + `images.imageSizes` in next.config.ts.
 */
export const IMAGE_DEVICE_SIZES = [360, 390, 414, 640, 768, 1024, 1280] as const;
export const IMAGE_SIZES = [48, 64, 96, 128, 160, 200, 256] as const;
const ALL_WIDTHS = [...IMAGE_SIZES, ...IMAGE_DEVICE_SIZES].sort((a, b) => a - b);
const QUALITY = 75;

export interface OptimizedImageInput {
  src: string;
  alt: string;
  /** Fill the positioned parent (like next/image `fill`). */
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}

export interface OptimizedImageProps {
  src: string;
  srcSet: string;
  sizes?: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  decoding: "async";
  style?: { position: "absolute"; inset: 0; width: "100%"; height: "100%" };
}

export function optimizedUrl(src: string, width: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${QUALITY}`;
}

/** Same width selection as next/image: responsive (sizes) → all widths; fixed width → 1x and 2x. */
export function optimizedImageProps(input: OptimizedImageInput): OptimizedImageProps {
  const { src, alt, fill, width, height, sizes, className, loading = "lazy", fetchPriority } = input;
  const external = /^https?:\/\//.test(src) && !src.includes("/storage/v1/object/public/");
  const svg = src.endsWith(".svg");
  let widths: number[];
  let descriptor: "w" | "x";
  if (sizes || fill || !width) {
    widths = ALL_WIDTHS;
    descriptor = "w";
  } else {
    const pick = (w: number) => ALL_WIDTHS.find((s) => s >= w) ?? ALL_WIDTHS[ALL_WIDTHS.length - 1]!;
    widths = [...new Set([pick(width), pick(width * 2)])];
    descriptor = "x";
  }
  const srcSet =
    external || svg
      ? ""
      : widths.map((w, i) => `${optimizedUrl(src, w)} ${descriptor === "w" ? `${w}w` : `${i + 1}x`}`).join(", ");
  return {
    src: external || svg ? src : optimizedUrl(src, widths[widths.length - 1]!),
    srcSet,
    sizes: descriptor === "w" ? (sizes ?? "100vw") : undefined,
    alt,
    width: fill ? undefined : width,
    height: fill ? undefined : height,
    className,
    loading,
    fetchPriority,
    decoding: "async",
    style: fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : undefined,
  };
}
