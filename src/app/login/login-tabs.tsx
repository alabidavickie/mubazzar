"use client";

import { useActionState, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { passwordLoginAction, requestOtpAction, verifyOtpAction, type AuthState } from "@/app/actions/auth";

export function LoginTabs({ next }: { next: string }) {
  const [tab, setTab] = useState<"customer" | "staff">("customer");
  return (
    <div>
      <div role="tablist" aria-label="Sign-in method" className="mb-4 grid grid-cols-2 rounded-lg bg-surface-container p-1">
        {(
          [
            ["customer", "Customer (code)"],
            ["staff", "Staff & partners (email)"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            id={`tab-${key}`}
            onClick={() => setTab(key)}
            className={cn(
              "min-h-11 rounded-md px-2 text-label-md",
              tab === key ? "bg-card font-bold text-navy shadow-card" : "text-ink-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "staff" ? <PasswordForm next={next} /> : <OtpForm next={next} />}
      </div>
    </div>
  );
}

function ErrorText({ state }: { state: AuthState }) {
  return state?.error ? (
    <p role="alert" className="rounded-lg bg-urgent-soft p-3 text-body-sm font-semibold text-urgent-ink">
      {state.error}
    </p>
  ) : null;
}

function PasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(passwordLoginAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-label-md font-semibold text-navy" htmlFor="login-email">
        Email
        <Input id="login-email" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="flex flex-col gap-1 text-label-md font-semibold text-navy" htmlFor="login-password">
        Password
        <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
      </label>
      <ErrorText state={state} />
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function OtpForm({ next }: { next: string }) {
  const [requestState, requestAction, requesting] = useActionState(requestOtpAction, null);
  const [verifyState, verifyAction, verifying] = useActionState(verifyOtpAction, null);
  const codeStep = requestState?.step === "code" || verifyState?.step === "code";
  const identifier = verifyState?.identifier ?? requestState?.identifier ?? "";

  if (!codeStep) {
    return (
      <form action={requestAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-label-md font-semibold text-navy" htmlFor="otp-identifier">
          Phone number or email
          <Input id="otp-identifier" name="identifier" inputMode="email" autoComplete="tel" placeholder="0803 123 4567" required />
        </label>
        <ErrorText state={requestState} />
        <Button type="submit" size="lg" block disabled={requesting}>
          {requesting ? "Sending…" : "Send login code"}
        </Button>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="flex flex-col gap-3">
      <input type="hidden" name="identifier" value={identifier} />
      <input type="hidden" name="next" value={next} />
      <p className="text-body-sm text-ink-muted">
        We sent a 6-digit code to <strong className="text-ink">{identifier}</strong>.
      </p>
      {requestState?.devCode ? (
        <p className="rounded-lg bg-gold-soft/30 p-2 text-body-sm text-bronze-ink">
          Development mode — your code is <strong data-testid="dev-otp">{requestState.devCode}</strong>
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-label-md font-semibold text-navy" htmlFor="otp-code">
        Login code
        <Input id="otp-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
      </label>
      <ErrorText state={verifyState} />
      <Button type="submit" size="lg" block disabled={verifying}>
        {verifying ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
