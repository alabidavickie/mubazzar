"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { captureAttribution } from "@/lib/client/attribution";
import { track } from "@/lib/client/pixel";

/**
 * Loads the Meta Pixel only when NEXT_PUBLIC_META_PIXEL_ID is configured, captures UTM/fbclid
 * attribution on landing, and fires PageView on every client-side navigation.
 */
export function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const pathname = usePathname();
  const search = useSearchParams();
  const last = useRef<string | null>(null);

  useEffect(() => {
    captureAttribution(`?${search.toString()}`);
  }, [search]);

  useEffect(() => {
    const key = `${pathname}?${search.toString()}`;
    if (last.current === key) return;
    last.current = key;
    track("PageView");
  }, [pathname, search]);

  if (!pixelId) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId.replace(/[^0-9]/g, "")}');`}
    </Script>
  );
}
