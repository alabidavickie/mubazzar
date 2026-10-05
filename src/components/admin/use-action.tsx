"use client";

import { useState, useTransition } from "react";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Runs a server action with pending state and an accessible success/error message. */
export function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) onOk?.();
    });
  return { pending, result, run, reset: () => setResult(null) };
}

export function ActionMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="rounded-lg bg-emerald-soft px-3 py-2 text-label-md text-emerald-ink" data-testid="action-ok">
      {result.message ?? "Saved."}
    </p>
  ) : (
    <p role="alert" className="rounded-lg bg-urgent-soft px-3 py-2 text-label-md text-urgent-ink" data-testid="action-error">
      {result.error}
    </p>
  );
}
