import { Icon } from "@/components/icons/icon";

// Kept apart from not-found-content (no next/link): global-error ships with every route.
/** Branded error body (500) with retry + WhatsApp help. */
export function ErrorContent({ onRetry, digest }: { onRetry: () => void; digest?: string }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-4 py-10 text-center" data-testid="error-page">
      <span className="flex size-16 items-center justify-center rounded-full bg-urgent-soft text-urgent shadow-card">
        <Icon name="error" className="text-4xl" />
      </span>
      <h1 className="font-display text-headline-xl font-bold text-navy">Something went wrong on our side</h1>
      <p className="text-body-md text-ink-muted">
        Sorry — this page didn&apos;t load. Your cart and any order you already placed are safe. Try again, or message us and we&apos;ll
        help you finish your order in chat.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-navy px-5 text-label-lg text-on-dark shadow-card"
        >
          <Icon name="refresh" /> Try again
        </button>
        <a
          href="/api/support/whatsapp"
          className="inline-flex min-h-12 items-center gap-1.5 rounded-lg bg-emerald-ink px-5 text-label-lg text-on-dark shadow-card"
        >
          <Icon name="chat" /> WhatsApp help
        </a>
      </div>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard navigation recovers from a broken client state */}
      <a href="/" className="inline-flex min-h-11 items-center text-label-md text-navy underline underline-offset-2">
        Go to the homepage
      </a>
      {digest ? <p className="text-body-sm text-ink-subtle">Error reference: {digest}</p> : null}
    </div>
  );
}
