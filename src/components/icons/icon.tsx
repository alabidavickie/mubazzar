import { cn } from "@/lib/cn";
import { ICON_PATHS, type IconName } from "./paths";

export type { IconName } from "./paths";

export interface IconProps {
  name: IconName | (string & {});
  /** Use the filled variant when one was generated (e.g. "star" → "star-fill"). */
  filled?: boolean;
  className?: string;
  /** Accessible label. Omit for decorative icons (default, aria-hidden). */
  label?: string;
}

/** Inline-SVG Material Symbol. Sized with font-size utilities like the original icon font (1em). */
export function Icon({ name, filled, className, label }: IconProps) {
  const key = (filled && `${name}-fill` in ICON_PATHS ? `${name}-fill` : name) as IconName;
  const d = ICON_PATHS[key] ?? ICON_PATHS.info;
  return (
    <svg
      viewBox="0 -960 960 960"
      width="1em"
      height="1em"
      fill="currentColor"
      className={cn("inline-block shrink-0 text-[1.25rem]", className)}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
