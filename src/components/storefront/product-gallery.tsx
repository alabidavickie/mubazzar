"use client";

import { useRef, useState } from "react";
import { cx } from "@/lib/cx";
import type { OptimizedImageProps } from "@/lib/image";

/**
 * Swipeable product gallery for /p/[slug]: CSS scroll-snap track (native swipe) + thumbnail buttons.
 * Image srcsets are computed on the server; overlays (discount, badges) are server-rendered children.
 */
export function ProductGallery({
  slides,
  thumbs,
  productName,
  children,
}: {
  slides: OptimizedImageProps[];
  thumbs: OptimizedImageProps[];
  productName: string;
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

  return (
    <div className="flex flex-col gap-2" data-testid="pdp-gallery">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface-high shadow-card">
        {slides.length ? (
          <div
            ref={track}
            onScroll={onScroll}
            tabIndex={0}
            role="region"
            aria-roledescription="carousel"
            aria-label={`${productName} photos, ${slides.length} ${slides.length === 1 ? "image" : "images"}`}
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
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt comes from the image props */}
                <img {...img} />
              </div>
            ))}
          </div>
        ) : null}
        {children}
        {slides.length > 1 ? (
          <span
            aria-hidden
            className="pointer-events-none absolute right-2 bottom-2 rounded-full bg-navy/80 px-2 py-0.5 text-label-sm text-on-dark tabular backdrop-blur-sm"
          >
            {active + 1}/{slides.length}
          </span>
        ) : null}
      </div>
      {thumbs.length > 1 ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          {thumbs.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1} of ${thumbs.length}`}
              aria-current={active === i ? "true" : undefined}
              className={cx(
                "relative size-16 shrink-0 overflow-hidden rounded-lg p-0.5 shadow-card transition",
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
