"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/client/pixel";

/** Fires the Meta `ViewContent` event once per landing page view. */
export function TrackViewContent({ productId, valueKobo }: { productId: string; valueKobo: number }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track("ViewContent", { content_ids: [productId], content_type: "product", value: valueKobo / 100, currency: "NGN" });
  }, [productId, valueKobo]);
  return null;
}
