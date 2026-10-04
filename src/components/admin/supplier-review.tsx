"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { reviewSubmissionAction, reviewSupplierAction, type ReviewResult } from "@/app/actions/admin-suppliers";
import { cn } from "@/lib/cn";

function useReview() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ReviewResult | null>(null);
  const run = (fn: () => Promise<ReviewResult>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) router.refresh();
    });
  const msg = result ? (
    <p role={result.ok ? "status" : "alert"} className={cn("text-label-sm", result.ok ? "text-emerald-ink" : "text-urgent-ink")}>
      {result.ok ? result.message : result.error}
    </p>
  ) : null;
  return { pending, run, msg };
}

export function SupplierDecision({ id, name }: { id: string; name: string }) {
  const [note, setNote] = useState("");
  const { pending, run, msg } = useReview();
  return (
    <div className="flex flex-col gap-2">
      <Input aria-label={`Note for ${name}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional, sent with a rejection)" className="py-2" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="whatsapp" disabled={pending} onClick={() => run(() => reviewSupplierAction({ id, approve: true, note }))}>
          Approve {name}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => reviewSupplierAction({ id, approve: false, note }))}>
          Reject
        </Button>
      </div>
      {msg}
    </div>
  );
}

export function SubmissionDecision({ id, name, proposed }: { id: string; name: string; proposed: string }) {
  const [price, setPrice] = useState(proposed);
  const [note, setNote] = useState("");
  const { pending, run, msg } = useReview();
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-label-sm text-ink-muted">
          Selling price (₦)
          <Input value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} className="py-2" />
        </label>
        <label className="text-label-sm text-ink-muted">
          Note
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="py-2" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="whatsapp" disabled={pending} onClick={() => run(() => reviewSubmissionAction({ id, approve: true, note, price }))}>
          Approve &amp; publish {name}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => reviewSubmissionAction({ id, approve: false, note }))}>
          Reject
        </Button>
      </div>
      {msg}
    </div>
  );
}
