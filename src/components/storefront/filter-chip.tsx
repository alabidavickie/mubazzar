import Link from "next/link";
import { cn } from "@/lib/cn";

const PILL = {
  price: {
    base: "rounded-full px-3 py-1 text-label-sm",
    on: "bg-navy text-on-dark shadow-card",
    off: "bg-card text-ink shadow-card group-hover:bg-surface-container",
  },
  sort: {
    base: "rounded-md px-3 py-1 text-label-sm",
    on: "bg-gold-soft font-bold text-bronze-ink",
    off: "bg-surface-high font-semibold text-ink-muted group-hover:bg-surface-container",
  },
  category: {
    base: "rounded-full px-3.5 py-1.5 text-label-md",
    on: "bg-navy text-on-dark shadow-card",
    off: "bg-card text-ink shadow-card group-hover:bg-surface-container",
  },
  gift: {
    base: "rounded-full px-3.5 py-1.5 text-label-md font-bold",
    on: "bg-navy text-gold-pale shadow-card",
    off: "bg-gold-soft text-bronze-ink shadow-card",
  },
} as const;

/**
 * Filter/sort pill rendered as a link (filters live in the URL). The link itself is a 44px-tall
 * tap target; the visible pill inside keeps the compact design proportions.
 */
export function FilterChip({
  href,
  active,
  kind = "price",
  children,
  className,
  testId,
}: {
  href: string;
  active: boolean;
  kind?: keyof typeof PILL;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  const s = PILL[kind];
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      data-testid={testId}
      data-active={active ? "true" : "false"}
      className={cn("group inline-flex min-h-11 shrink-0 items-center rounded-full", className)}
    >
      <span className={cn("inline-flex items-center gap-1 whitespace-nowrap transition-colors", s.base, active ? s.on : s.off)}>
        {children}
      </span>
    </Link>
  );
}
