"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons/icon";
import { importProductsAction, type ImportActionResult } from "@/app/actions/admin-product-import";
import { cn } from "@/lib/cn";

const ACTION_LABEL = { create: "New", update: "Update", error: "Problem" } as const;

/** Choose CSV → Preview (nothing saved) → Import. The file is sent again on import and re-checked. */
export function ProductImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportActionResult | null>(null);
  const [pending, start] = useTransition();

  const send = (mode: "preview" | "apply") => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setResult({ ok: false, error: "Choose a CSV file." });
    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);
    start(async () => setResult(await importProductsAction(fd)));
  };

  const ok = result?.ok ? result : null;
  const importable = ok && !ok.applied ? ok.created + ok.updated : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card">
        <label className="flex flex-col gap-1 text-label-md font-semibold text-ink">
          CSV file
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFileName(e.target.files?.[0]?.name ?? null);
              setResult(null);
            }}
            className="min-h-11 rounded-lg border border-line bg-surface p-2 text-body-md file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-on-dark"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send("preview")} disabled={pending || !fileName} variant="soft">
            <Icon name="visibility" /> {pending && !importable ? "Checking…" : "Preview"}
          </Button>
          {importable > 0 ? (
            <Button onClick={() => send("apply")} disabled={pending} data-testid="import-apply">
              <Icon name="upload" /> {pending ? "Importing…" : `Import ${importable} product${importable === 1 ? "" : "s"}`}
            </Button>
          ) : null}
        </div>
      </div>

      {result && !result.ok ? (
        <div role="alert" className="rounded-lg bg-urgent-soft px-3 py-2 text-label-md text-urgent-ink" data-testid="import-error">
          {result.error}
          {result.fileErrors && result.fileErrors.length > 1 ? (
            <ul className="mt-1 list-disc pl-5">
              {result.fileErrors.slice(1).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {ok ? (
        <section className="flex flex-col gap-2" aria-label="Import results" data-testid="import-results">
          <p role="status" className={cn("rounded-lg px-3 py-2 text-label-md", ok.applied ? "bg-emerald-soft text-emerald-ink" : "bg-surface-high text-ink")} data-testid="import-summary">
            {ok.applied
              ? `Imported: ${ok.created} new, ${ok.updated} updated${ok.failed ? `, ${ok.failed} skipped (see below)` : ""}.`
              : `Preview — nothing saved yet: ${ok.created} new, ${ok.updated} to update${ok.failed ? `, ${ok.failed} with problems (they will be skipped)` : ""}.`}
            {!ok.applied && ok.results.some((r) => r.action !== "error") ? " Photo links are downloaded when you import." : ""}
          </p>
          {ok.ignoredColumns.length ? (
            <p className="text-body-sm text-ink-muted">Ignored columns: {ok.ignoredColumns.join(", ")}</p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {ok.results.map((r) => (
              <li key={r.line} className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-card px-3 py-2 text-body-sm shadow-card" data-testid="import-row">
                <span className="tabular text-ink-muted">Line {r.line}</span>
                <span className="font-semibold text-ink">{r.slug || "—"}</span>
                <span className={cn("rounded-full px-2 text-label-sm font-bold", r.action === "error" ? "bg-urgent-soft text-urgent-ink" : r.action === "create" ? "bg-emerald-soft text-emerald-ink" : "bg-surface-high text-navy")}>
                  {ACTION_LABEL[r.action]}
                </span>
                {r.messages.length ? <span className="basis-full text-urgent-ink">{r.messages.join(" ")}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
