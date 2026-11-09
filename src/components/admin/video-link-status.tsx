"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { parseVideoLink, VIDEO_PLATFORM_LABEL } from "@/lib/video-embed";

/** Instant feedback under the video link field: what we detected, what's wrong, and a preview to try it. */
export function VideoLinkStatus({ url }: { url: string }) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  if (!url.trim()) return null;

  const result = parseVideoLink(url);
  if (!result.ok) {
    return (
      <p role="status" className="mt-2 flex items-start gap-1 text-body-sm font-semibold text-urgent" data-testid="video-link-status">
        <Icon name="error" className="shrink-0 text-base" /> {result.message}
      </p>
    );
  }

  const { platform, embedUrl, shortLink, vertical } = result.video;
  const showing = previewing === url;
  return (
    <div className="mt-2 flex flex-col gap-2" data-testid="video-link-status">
      <p role="status" className="flex items-start gap-1 text-body-sm font-semibold text-emerald-ink">
        <Icon name="check_circle" className="shrink-0 text-base" />
        {VIDEO_PLATFORM_LABEL[platform]} link recognised.{" "}
        {shortLink ? "It's a short share link, so we'll get the full link when you save." : "It will play on the product's page."}
      </p>
      {platform !== "direct" && embedUrl ? (
        <button
          type="button"
          onClick={() => setPreviewing(showing ? null : url)}
          aria-expanded={showing}
          className="flex min-h-11 w-fit items-center gap-1 rounded-lg bg-surface-container px-3 text-label-md text-navy hover:bg-surface-high"
        >
          <Icon name={showing ? "close" : "play_arrow"} className="text-base" /> {showing ? "Close preview" : "Preview video"}
        </button>
      ) : null}
      {showing && embedUrl ? (
        <div className={vertical ? "relative aspect-[9/16] w-full max-w-xs overflow-hidden rounded-lg bg-navy" : "relative aspect-video w-full max-w-md overflow-hidden rounded-lg bg-navy"}>
          <iframe
            src={embedUrl}
            title="Video preview"
            className="absolute inset-0 size-full"
            allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : null}
      {showing ? <p className="text-body-sm text-ink-muted">If it doesn&apos;t play here, the post isn&apos;t Public. Change its privacy on the social app.</p> : null}
    </div>
  );
}
