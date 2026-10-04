"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { cn } from "@/lib/cn";

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className={cn(
        "inline-flex min-h-10 items-center gap-1 rounded-lg bg-surface-high px-3 text-label-sm font-bold text-navy hover:bg-surface-highest",
        className,
      )}
    >
      <Icon name={copied ? "check" : "content_copy"} className="text-base" />
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
