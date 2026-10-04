"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { StaticImgProps } from "./static-img";

/**
 * Swipeable product showcase: CSS scroll-snap track (native swipe, no JS library) + thumbnail
 * buttons. Image props (srcset/sizes) are computed on the server with getImageProps, so no
 * next/image runtime ships. Overlays (discount tag, warranty, caption) are server-rendered children.
 * The first slide is the page's LCP image (eager, high priority, preloaded by the page).
 */
export function LandingGallery({
  slides,
  thumbs,
  children,
}: {
  slides: StaticImgProps[];
  thumbs: StaticImgProps[];
  children?: React.ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
    setActive(i);
  };

  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const i = Math.max(0, Math.min(slides.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
    if (i !== active) setActive(i);
  };

  if (slides.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" data-testid="lp-gallery">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-container shadow-raised">
        <div
          ref={track}
          onScroll={onScroll}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label={`Product photos, ${slides.length} images. Swipe or use the thumbnails.`}
          className="no-scrollbar flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {slides.map((img, i) => (
            <div
              key={img.src}
              className="relative size-full shrink-0 snap-center snap-always"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- props from getImageProps include alt */}
              <img {...img} />
            </div>
          ))}
        </div>
        {children}
      </div>
      {thumbs.length > 1 ? (
        <div className="grid grid-cols-5 gap-2">
          {thumbs.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1} of ${thumbs.length}`}
              aria-current={active === i ? "true" : undefined}
              className={cn(
                "relative aspect-square min-h-11 overflow-hidden rounded-lg p-0.5 shadow-card transition",
                active === i ? "bg-gold" : "bg-surface-container opacity-80 hover:opacity-100",
              )}
            >
              <span className="relative block size-full overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- decorative thumbnail (alt="") */}
                <img {...img} />
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
