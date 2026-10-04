"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/cx";
import { formatNaira } from "@/lib/money";
import { optimizedImageProps } from "@/lib/image";
import { Icon } from "@/components/icons/icon";

interface Suggestion {
  slug: string;
  name: string;
  priceKobo: number;
  imageUrl: string | null;
}

const DEBOUNCE_MS = 250;

/**
 * Search input with instant product suggestions (WAI-ARIA 1.2 combobox + listbox).
 * Arrow keys move through suggestions, Enter opens the highlighted product (or submits the search
 * when nothing is highlighted), Escape closes the list. Without JS it is a plain GET search form.
 */
export function SearchBox({
  action,
  defaultValue = "",
  hidden = {},
  placeholder = "Search gadgets, problem solvers, kitchen tech…",
  label = "Search products",
  trailing,
  autoFocus,
  className,
  inputClassName,
}: {
  action: string;
  defaultValue?: string;
  /** Extra query params to keep when the form is submitted (current filters). */
  hidden?: Record<string, string>;
  placeholder?: string;
  label?: string;
  trailing?: React.ReactNode;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const router = useRouter();
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const [value, setValue] = useState(defaultValue);
  // Suggestions per normalised term; the list shown is always the one for the current term.
  const [results, setResults] = useState<Record<string, Suggestion[]>>({});
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loadingTerm, setLoadingTerm] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const termKey = value.trim().toLowerCase();
  const items = termKey.length >= 2 ? (results[termKey] ?? []) : [];
  const loading = loadingTerm === termKey;

  // Debounced fetch of suggestions for the current term (state only changes in async callbacks).
  useEffect(() => {
    if (termKey.length < 2 || results[termKey]) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoadingTerm(termKey);
      fetch(`/api/search/suggest?q=${encodeURIComponent(termKey)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items: Suggestion[] }) => {
          setResults((prev) => ({ ...prev, [termKey]: d.items }));
          setActive(-1);
        })
        .catch(() => undefined)
        .finally(() => setLoadingTerm((cur) => (cur === termKey ? null : cur)));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [termKey, results]);

  // Close when focus/clicks leave the widget.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const showList = open && items.length > 0;

  const go = (s: Suggestion) => {
    setOpen(false);
    router.push(`/p/${s.slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      if (items.length) setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (items.length) setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      const s = showList && active >= 0 ? items[active] : undefined;
      if (s) {
        e.preventDefault();
        go(s);
      }
    } else if (e.key === "Escape") {
      if (showList) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  };

  const status = termKey.length < 2 ? "" : loading ? "Searching…" : items.length ? `${items.length} suggestions available. Use up and down arrows to choose.` : "";

  return (
    <form action={action} role="search" className={cx("relative w-full", className)} onSubmit={() => setOpen(false)}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div ref={wrapRef} className="relative">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xl text-ink-muted" />
        <input
          id={inputId}
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={cx(
            "h-12 w-full rounded-xl bg-card pl-10 text-body-md text-ink shadow-card outline-none transition-shadow placeholder:text-ink-subtle focus:shadow-raised focus-visible:ring-2 focus-visible:ring-gold",
            trailing ? "pr-28" : "pr-4",
            inputClassName,
          )}
        />
        {trailing ? <div className="absolute top-1/2 right-1 -translate-y-1/2">{trailing}</div> : null}
        <ul
          id={listId}
          role="listbox"
          aria-label="Product suggestions"
          hidden={!showList}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-[60dvh] overflow-y-auto rounded-xl bg-card p-1 shadow-float"
          data-testid="search-suggestions"
        >
          {items.map((s, i) => {
            const img = s.imageUrl ? optimizedImageProps({ src: s.imageUrl, alt: "", width: 40, height: 40, className: "size-10 rounded-md object-cover" }) : null;
            return (
              <li
                key={s.slug}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={active === i}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => go(s)}
                onPointerEnter={() => setActive(i)}
                className={cx(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5",
                  active === i ? "bg-surface-container" : "hover:bg-surface-low",
                )}
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- decorative, alt=""
                  <img {...img} />
                ) : (
                  <span className="size-10 shrink-0 rounded-md bg-surface-high" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate text-label-md text-ink">{s.name}</span>
                <span className="shrink-0 text-label-md font-extrabold text-navy-deep tabular">{formatNaira(s.priceKobo)}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {open ? status : ""}
      </p>
    </form>
  );
}
