import { cx } from "@/lib/cx";
import { FILLED_ICONS, ICON_SPRITE_URL, type IconName } from "./names";

export type { IconName } from "./names";

export interface IconProps {
  name: IconName | (string & {});
  /** Use the filled variant when one was generated (e.g. "star" → "star-fill"). */
  filled?: boolean;
  className?: string;
  /** Accessible label. Omit for decorative icons (default, aria-hidden). */
  label?: string;
}

/**
 * Material Symbol from the generated SVG sprite (public/icons.svg). Icon path data never ships in
 * JavaScript, so client components can use icons freely. Sized like the icon font (1em).
 */
export function Icon({ name, filled, className, label }: IconProps) {
  const id = filled && FILLED_ICONS.has(name) ? `${name}-fill` : name;
  return (
    <svg
      width="1em"
      height="1em"
      fill="currentColor"
      className={cx("icon inline-block shrink-0", className)}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      <use href={`${ICON_SPRITE_URL}#${id}`} />
    </svg>
  );
}
