import Link from "next/link";
import { cn } from "@/lib/cn";

const base =
  "inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 font-sans text-label-md font-semibold transition-colors";
const tones = {
  active: "bg-navy text-on-dark shadow-card",
  idle: "bg-card text-ink shadow-card hover:bg-surface-container",
  gold: "bg-gold-soft text-bronze-ink font-bold shadow-card",
  muted: "bg-surface-high text-ink-muted hover:bg-surface-container",
};

export interface ChipProps {
  active?: boolean;
  tone?: keyof typeof tones;
  className?: string;
  children: React.ReactNode;
}

export function ChipLink({
  href,
  active,
  tone,
  className,
  children,
  scroll,
  replace,
  ...rest
}: ChipProps & { href: string; scroll?: boolean; replace?: boolean } & Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    "href"
  >) {
  return (
    <Link
      href={href}
      scroll={scroll}
      replace={replace}
      aria-current={active ? "true" : undefined}
      className={cn(base, tones[tone ?? (active ? "active" : "idle")], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function ChipButton({
  active,
  tone,
  className,
  children,
  ...rest
}: ChipProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(base, tones[tone ?? (active ? "active" : "idle")], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
