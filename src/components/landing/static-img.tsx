import { getImageProps, type ImageProps } from "next/image";

/**
 * Server-rendered optimised image (same srcset/sizes/AVIF/WebP pipeline as next/image) that ships
 * no client JavaScript — used on the ad landing page to keep its first-load JS small.
 */
export function StaticImg(props: ImageProps) {
  const { props: img } = getImageProps(props);
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt is passed through from props
  return <img {...img} />;
}

/** Image props for client components that render a plain <img> (no next/image runtime). */
export function staticImgProps(props: ImageProps) {
  return getImageProps(props).props;
}

export type StaticImgProps = ReturnType<typeof staticImgProps>;
