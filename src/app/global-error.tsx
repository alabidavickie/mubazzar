"use client";

import "./globals.css";
import { useEffect } from "react";
import { ErrorContent } from "@/components/storefront/not-found-content";

/** Last-resort error screen (replaces the root layout, so it renders its own <html>). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en-NG">
      <body className="min-h-dvh bg-surface font-sans text-ink antialiased">
        <header className="bg-navy-deep px-4 py-3 text-center">
          <span className="font-display text-headline-sm font-extrabold tracking-wider text-gold-pale">MUBAZZAR</span>
        </header>
        <main id="main">
          <ErrorContent onRetry={reset} digest={error.digest} />
        </main>
      </body>
    </html>
  );
}
