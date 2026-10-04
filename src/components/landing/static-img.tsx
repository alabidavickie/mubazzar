import { optimizedImageProps, type OptimizedImageInput, type OptimizedImageProps } from "@/lib/image";

/**
 * Server-rendered optimised image (Next's /_next/image optimizer: AVIF/WebP, responsive srcset)
 * that ships no client JavaScript — used on the ad landing page to keep first-load JS small.
 */
export function StaticImg(props: OptimizedImageInput) {
  const img = optimizedImageProps(props);
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt is passed through from props
  return <img {...img} />;
}

/** Image props for client components that render a plain <img>. */
export function staticImgProps(props: OptimizedImageInput): OptimizedImageProps {
  return optimizedImageProps(props);
}

export type StaticImgProps = OptimizedImageProps;
