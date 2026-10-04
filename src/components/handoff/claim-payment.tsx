"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons/icon";
import { claimPaymentAction } from "@/app/actions/handoff";

/** "I've sent my payment" — tells staff to check the bank. It never marks the order as paid. */
export function ClaimPaymentButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<"claimed" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (result === "claimed") {
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-soft p-3 text-body-sm text-emerald-ink" data-testid="claim-confirmation">
        <Icon name="task_alt" className="mt-0.5 text-base" />
        <span>
          Thanks! We&apos;ve told our team. They&apos;ll confirm once the money reaches MUBAZZAR&apos;s account and update you in chat.
        </span>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending}
        data-testid="claim-payment"
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await claimPaymentAction(token);
            if (res.ok) setResult("claimed");
            else {
              setResult("error");
              setError(res.error);
            }
          })
        }
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-navy bg-card px-4 text-label-lg font-bold text-navy disabled:opacity-60"
      >
        <Icon name={pending ? "autorenew" : "payments"} className={pending ? "animate-spin" : undefined} />
        {pending ? "Sending…" : "I've sent my payment"}
      </button>
      {result === "error" && error ? (
        <p role="alert" className="text-body-sm text-urgent">
          {error}
        </p>
      ) : (
        <p className="text-body-sm text-ink-muted">Tap this only after you&apos;ve paid into the account our team gave you in chat.</p>
      )}
    </div>
  );
}
