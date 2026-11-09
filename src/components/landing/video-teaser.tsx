"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";

/**
 * Click-to-load demo video. Nothing heavy loads until the visitor taps play: social and YouTube links
 * become an iframe built by parseVideoLink, a direct file a native <video>. Rendered only when the
 * landing page actually has a playable video (no fake play buttons).
 */
export function VideoPlayer({
  videoUrl,
  embedUrl,
  title,
  poster,
}: {
  videoUrl: string;
  embedUrl: string | null;
  title: string;
  poster: React.ReactNode;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return embedUrl ? (
      <iframe
        src={embedUrl}
        title={title}
        className="absolute inset-0 size-full"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    ) : (
      <video src={videoUrl} className="absolute inset-0 size-full bg-navy-deep object-contain" controls autoPlay playsInline preload="none" />
    );
  }

  return (
    <>
      {poster}
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-navy-deep/45 p-4 text-center text-on-dark"
        aria-label={`Play video: ${title}`}
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-gold-soft text-bronze-ink shadow-float">
          <Icon name="play_arrow" filled className="text-3xl" />
        </span>
      </button>
    </>
  );
}
