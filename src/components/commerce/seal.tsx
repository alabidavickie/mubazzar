import { useId } from "react";
import { cx } from "@/lib/cx";

/**
 * The "MUBAZZAR TESTED" seal — the sticker approved units are resealed with before dispatch
 * (STRESS_TEST_STEPS step 4). It is the site's one signature mark: used on the hero, the
 * Standard section and the product page, never as decoration on every card.
 * Pure SVG, colours from currentColor + tokens, no client JS.
 */
export function TestedSeal({ className, label = "Tested by MUBAZZAR before dispatch" }: { className?: string; label?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={label} className={cx("text-gold", className)}>
      <defs>
        <path id={`seal-ring-${id}`} d="M60 60 m-43 0 a43 43 0 1 1 86 0 a43 43 0 1 1 -86 0" />
      </defs>
      {/* Scalloped sticker edge */}
      <g fill="currentColor">
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return <circle key={i} cx={60 + Math.cos(a) * 54} cy={60 + Math.sin(a) * 54} r="6" />;
        })}
        <circle cx="60" cy="60" r="54" />
      </g>
      <circle cx="60" cy="60" r="49" className="fill-navy-deep" />
      <circle cx="60" cy="60" r="33" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text className="fill-current" fontSize="10.5" fontWeight="800" letterSpacing="2.6" fontFamily="var(--font-sans)">
        <textPath href={`#seal-ring-${id}`} startOffset="0">
          MUBAZZAR • TESTED • SEALED •
        </textPath>
      </text>
      {/* Check mark */}
      <path d="M45 61.5 55.5 72 76 50" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
