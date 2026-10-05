"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/icons/icon";
import { saveSettingAction, type SettingsResult } from "@/app/actions/admin-settings";
import { cn } from "@/lib/cn";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "checkbox" | "time" | "select";
  options?: { value: string; label: string }[];
  hint?: string;
}

type Row = Record<string, unknown>;

/**
 * One form for any `settings` row: scalar (`fields` = [{ name: "_" }]), object, or list of objects.
 * Validation happens on the server with the setting's Zod schema; errors map back by path.
 */
export function SettingForm({
  settingKey,
  title,
  hint,
  kind,
  fields,
  initial,
  maxItems = 6,
}: {
  settingKey: string;
  title: string;
  hint?: string;
  kind: "scalar" | "object" | "list";
  fields: FieldDef[];
  initial: unknown;
  maxItems?: number;
}) {
  const [value, setValue] = useState<unknown>(initial);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SettingsResult | null>(null);
  const err = (path: string) => (result && !result.ok ? result.fieldErrors?.[path] : undefined);

  const control = (f: FieldDef, current: unknown, onChange: (v: unknown) => void, path: string) => {
    if (f.type === "checkbox") {
      return (
        <label key={path} className="flex min-h-11 items-center gap-2 text-label-md">
          <input type="checkbox" checked={Boolean(current)} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-navy" />
          {f.label}
        </label>
      );
    }
    return (
      <Field key={path} label={f.label} hint={f.hint} error={err(path)}>
        {({ id, describedBy, invalid }) =>
          f.type === "textarea" ? (
            <Textarea id={id} rows={3} value={String(current ?? "")} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => onChange(e.target.value)} />
          ) : f.type === "select" ? (
            <Select id={id} value={String(current ?? "")} onChange={(e) => onChange(e.target.value)}>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id={id}
              type={f.type === "number" ? "number" : f.type === "time" ? "time" : "text"}
              value={Array.isArray(current) ? current.join(", ") : String(current ?? "")}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => onChange(f.type === "number" ? Number(e.target.value) : e.target.value)}
            />
          )
        }
      </Field>
    );
  };

  const rows = kind === "list" ? ((value as Row[]) ?? []) : [];
  return (
    <form
      className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card"
      aria-label={title}
      data-testid={`setting-${settingKey}`}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setResult(await saveSettingAction({ key: settingKey, value })));
      }}
    >
      <div>
        <h2 className="text-label-lg font-bold text-navy">{title}</h2>
        {hint ? <p className="text-body-sm text-ink-muted">{hint}</p> : null}
      </div>
      {kind === "scalar" ? control(fields[0]!, value, setValue, "") : null}
      {kind === "object" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fields.map((f) => control(f, (value as Row)?.[f.name], (v) => setValue({ ...(value as Row), [f.name]: v }), f.name))}
        </div>
      ) : null}
      {kind === "list" ? (
        <>
          {rows.map((row, i) => (
            <fieldset key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-line p-3 sm:grid-cols-3">
              <legend className="flex w-full items-center justify-between px-1 text-label-sm font-bold text-navy">
                #{i + 1}
                <button type="button" onClick={() => setValue(rows.filter((_, j) => j !== i))} className="flex size-9 items-center justify-center rounded-md bg-urgent-soft text-urgent-ink" aria-label={`Remove item ${i + 1}`}>
                  <Icon name="delete" className="text-base" />
                </button>
              </legend>
              {fields.map((f) => control(f, row[f.name], (v) => setValue(rows.map((r, j) => (j === i ? { ...r, [f.name]: v } : r))), `${i}.${f.name}`))}
            </fieldset>
          ))}
          <Button variant="soft" disabled={rows.length >= maxItems} onClick={() => setValue([...rows, Object.fromEntries(fields.map((f) => [f.name, f.options?.[0]?.value ?? ""]))])}>
            <Icon name="add" /> Add
          </Button>
        </>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {result ? (
          <p role={result.ok ? "status" : "alert"} className={cn("text-label-md", result.ok ? "text-emerald-ink" : "text-urgent-ink")}>
            {result.ok ? result.message : result.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
