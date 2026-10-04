"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { assignDispatcherAction } from "@/app/actions/admin-orders";
import { ActionMessage, useAction } from "./use-action";

export function AssignDispatcherForm({
  orderId,
  dispatchers,
  currentId,
  defaultHub,
}: {
  orderId: string;
  dispatchers: { id: string; name: string; hubCode: string | null }[];
  currentId: string | null;
  defaultHub: string | null;
}) {
  const { pending, result, run } = useAction();
  const preferred = dispatchers.find((d) => d.hubCode && d.hubCode === defaultHub)?.id ?? dispatchers[0]?.id ?? "";
  const [value, setValue] = useState(currentId ?? preferred);
  if (dispatchers.length === 0) return <p className="text-body-sm text-ink-muted">No active dispatchers yet — add one under Staff &amp; riders.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Field label={currentId ? "Reassign to" : "Assign dispatcher"} className="flex-1">
          {({ id }) => (
            <Select id={id} value={value} onChange={(e) => setValue(e.target.value)}>
              {dispatchers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.hubCode ? ` (${d.hubCode})` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button disabled={pending || !value || value === currentId} onClick={() => run(() => assignDispatcherAction({ orderId, dispatcherId: value }))}>
          {currentId ? "Reassign" : "Assign"}
        </Button>
      </div>
      <ActionMessage result={result} />
    </div>
  );
}
