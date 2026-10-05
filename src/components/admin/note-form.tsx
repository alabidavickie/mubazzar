"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { addOrderNoteAction } from "@/app/actions/admin-orders";
import { ActionMessage, useAction } from "./use-action";

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const { pending, result, run } = useAction();
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <Field label="Internal note">
        {({ id }) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Visible to staff only" />}
      </Field>
      <Button variant="soft" disabled={pending || !note.trim()} onClick={() => run(() => addOrderNoteAction({ orderId, note }), () => setNote(""))}>
        Add note
      </Button>
      <ActionMessage result={result} />
    </div>
  );
}
