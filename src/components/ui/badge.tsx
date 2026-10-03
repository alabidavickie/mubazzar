import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons/icon";

export const badgeVariants = cva("inline-flex items-center gap-1 font-sans font-bold leading-none", {
  variants: {
    tone: {
      navy: "bg-navy text-gold-pale",
      navyGlass: "bg-navy/90 text-gold-pale backdrop-blur-sm",
      gold: "bg-gold-soft text-bronze-ink",
      goldSoft: "bg-gold-soft/40 text-bronze",
      emerald: "bg-emerald-ink text-on-dark",
      emeraldSoft: "bg-emerald-soft text-emerald-ink",
      bronze: "bg-bronze text-on-dark",
      red: "bg-urgent text-on-dark",
      redSoft: "bg-urgent-soft text-urgent-ink",
      neutral: "bg-surface-container text-ink",
      muted: "bg-surface-high text-navy",
      outline: "border border-line bg-card text-ink-muted",
    },
    size: {
      xs: "rounded px-1.5 py-0.5 text-[0.625rem]",
      sm: "rounded px-1.5 py-1 text-label-sm",
      md: "rounded-md px-2 py-1 text-label-md",
      pill: "rounded-full px-2.5 py-1 text-label-sm",
    },
  },
  defaultVariants: { tone: "neutral", size: "sm" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  icon?: IconName | string | null;
  iconFilled?: boolean;
}

export function Badge({ className, tone, size, icon, iconFilled, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {icon ? <Icon name={icon} filled={iconFilled} className="text-[0.95em]" /> : null}
      {children}
    </span>
  );
}

/** Maps a product's admin-chosen badge style to a badge tone (see products.image_badge_style). */
export const BADGE_STYLE_TONE = {
  navy: "navyGlass",
  emerald: "emerald",
  gold: "gold",
  bronze: "bronze",
  red: "redSoft",
} as const;
