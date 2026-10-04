"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/icons/icon";
import { SearchBox } from "./search-box";

/**
 * Catalog search bar with the "Filter" toggle (design: Shop Catalog) and the collapsible
 * "Fast Refinements" panel below it. The panel content is server-rendered links/forms.
 */
export function FilterDisclosure({
  action,
  q,
  hidden,
  activeCount,
  defaultOpen,
  children,
}: {
  action: string;
  q: string;
  hidden: Record<string, string>;
  activeCount: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <SearchBox
        key={q}
        action={action}
        defaultValue={q}
        hidden={hidden}
        trailing={
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="flex min-h-11 items-center gap-1 rounded-lg px-1 text-label-md text-navy"
          >
            <span className="flex items-center gap-1 rounded-lg bg-surface-container px-2.5 py-1.5">
              <Icon name="tune" className="text-sm" />
              Filter
              {activeCount > 0 ? (
                <span className="flex size-4.5 items-center justify-center rounded-full bg-gold-soft text-[0.625rem] font-extrabold text-bronze-ink">
                  {activeCount}
                  <span className="sr-only"> active</span>
                </span>
              ) : null}
            </span>
          </button>
        }
      />
      <section
        id={panelId}
        hidden={!open}
        aria-labelledby={`${panelId}-title`}
        className="flex flex-col gap-2 rounded-xl bg-surface-low p-3 shadow-[inset_0_2px_4px_rgb(14_41_75/0.05)]"
        data-testid="filter-panel"
      >
        <div className="flex items-center justify-between">
          <h2 id={`${panelId}-title`} className="text-label-md font-bold tracking-wider text-navy-deep uppercase">
            Fast Refinements
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-controls={panelId}
            className="-mr-2 min-h-11 px-2 text-label-sm font-bold text-bronze"
          >
            Done
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
