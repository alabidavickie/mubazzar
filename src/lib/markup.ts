import { createElement, Fragment, type ReactNode } from "react";

/**
 * Tiny admin-text markup for landing-page headlines:
 *   ~~₦4,000~~  → red strikethrough
 *   **bold**    → bold
 * Everything else is plain text. Output is React nodes (text is escaped by React) — never HTML strings.
 * Unclosed markers are kept as literal text. Markers do not nest.
 */
export type MarkupSegment = { kind: "text" | "strike" | "bold"; text: string };

const TOKEN = /(~~|\*\*)([\s\S]+?)\1/g;

export function parseMarkup(input: string | null | undefined): MarkupSegment[] {
  if (!input) return [];
  const out: MarkupSegment[] = [];
  let last = 0;
  const push = (seg: MarkupSegment) => {
    if (!seg.text) return;
    const prev = out[out.length - 1];
    if (prev && prev.kind === "text" && seg.kind === "text") prev.text += seg.text;
    else out.push(seg);
  };
  for (const m of input.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    const inner = m[2] ?? "";
    // "~~ ~~" or "** **" (whitespace only) is not formatting — keep it literal.
    if (!inner.trim()) continue;
    push({ kind: "text", text: input.slice(last, start) });
    push({ kind: m[1] === "~~" ? "strike" : "bold", text: inner });
    last = start + m[0].length;
  }
  push({ kind: "text", text: input.slice(last) });
  return out;
}

export interface MarkupClasses {
  strike?: string;
  bold?: string;
}

const DEFAULT_CLASSES: Required<MarkupClasses> = {
  strike: "font-bold text-urgent line-through",
  bold: "font-bold text-navy",
};

/** Renders parsed markup to safe React nodes. */
export function renderMarkup(input: string | null | undefined, classes: MarkupClasses = {}): ReactNode {
  const cls = { ...DEFAULT_CLASSES, ...classes };
  const segments = parseMarkup(input);
  return createElement(
    Fragment,
    null,
    ...segments.map((s, i) => {
      if (s.kind === "strike") return createElement("s", { key: i, className: cls.strike }, s.text);
      if (s.kind === "bold") return createElement("strong", { key: i, className: cls.bold }, s.text);
      return createElement(Fragment, { key: i }, s.text);
    }),
  );
}

/** Plain text version (markers stripped) for <title>, meta descriptions and JSON-LD. */
export function markupToPlainText(input: string | null | undefined): string {
  return parseMarkup(input)
    .map((s) => s.text)
    .join("");
}
