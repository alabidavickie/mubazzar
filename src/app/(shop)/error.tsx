"use client";

import { useEffect } from "react";
import { ErrorContent } from "@/components/storefront/not-found-content";

/** Branded 500 inside the storefront chrome (header, bottom nav and WhatsApp button stay usable). */
export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorContent onRetry={reset} digest={error.digest} />;
}
