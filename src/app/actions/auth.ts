"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clearSessionCookie,
  createSessionCookie,
  requestOtp,
  signInWithPassword,
  verifyOtp,
} from "@/server/adapters/auth";
import { hashIp, peekRateLimit, rateLimit } from "@/server/adapters/rate-limit";
import { asService } from "@/server/db";
import { homeForRole, type AppRole } from "@/server/session";
import { normalizeNgPhone } from "@/lib/phone";

export type AuthState = { error?: string; step?: "code"; identifier?: string; devCode?: string } | null;

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** Only allow same-site relative redirects after login. */
function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

async function roleOf(userId: string): Promise<AppRole> {
  const rows = await asService((q) => q.query<{ role: AppRole }>("select role from public.profiles where id = $1", [userId]));
  return rows[0]?.role ?? "customer";
}

const passwordSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(6, "Enter your password").max(200),
});

export async function passwordLoginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = passwordSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  const ip = hashIp(await clientIp());
  // Per IP: every attempt counts. Per account: only FAILED attempts count, so nobody can lock the owner
  // out by spamming their email, and normal sign-ins never use up the budget.
  const emailKey = `login:email-fail:${parsed.data.email.toLowerCase()}`;
  const [byIp, byEmail] = await Promise.all([rateLimit(`login:ip:${ip}`, 20, 900), peekRateLimit(emailKey, 8, 900)]);
  if (!byIp.ok || !byEmail.ok) return { error: "Too many attempts. Please wait 15 minutes and try again." };
  const res = await signInWithPassword(parsed.data.email, parsed.data.password);
  if (!res.ok) {
    await rateLimit(emailKey, 8, 900);
    return { error: res.error };
  }
  await createSessionCookie({ sub: res.userId, email: res.email });
  const role = await roleOf(res.userId);
  redirect(safeNext(form.get("next")) ?? homeForRole(role));
}

function normaliseIdentifier(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const v = raw.trim();
  if (v.includes("@")) {
    const email = z.email().safeParse(v.toLowerCase());
    return email.success ? { ok: true, value: email.data } : { ok: false, error: "Enter a valid email address" };
  }
  const phone = normalizeNgPhone(v);
  return phone.ok ? { ok: true, value: phone.e164 } : { ok: false, error: phone.error };
}

export async function requestOtpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const id = normaliseIdentifier(String(form.get("identifier") ?? ""));
  if (!id.ok) return { error: id.error };
  const ip = hashIp(await clientIp());
  const [byIp, byId] = await Promise.all([rateLimit(`otp:ip:${ip}`, 10, 900), rateLimit(`otp:id:${id.value}`, 5, 900)]);
  if (!byIp.ok || !byId.ok) return { error: "Too many code requests. Please wait 15 minutes." };
  const res = await requestOtp(id.value);
  if (!res.ok) return { error: res.error };
  return { step: "code", identifier: id.value, devCode: res.devCode };
}

export async function verifyOtpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const identifier = String(form.get("identifier") ?? "");
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  const id = normaliseIdentifier(identifier);
  if (!id.ok) return { error: id.error };
  if (code.length !== 6) return { step: "code", identifier: id.value, error: "Enter the 6-digit code" };
  const ip = hashIp(await clientIp());
  const limited = await rateLimit(`otp-verify:${ip}:${id.value}`, 10, 900);
  if (!limited.ok) return { error: "Too many attempts. Please request a new code later." };
  const res = await verifyOtp(id.value, code);
  if (!res.ok) return { step: "code", identifier: id.value, error: res.error };
  await createSessionCookie({ sub: res.userId, email: res.email });
  const role = await roleOf(res.userId);
  redirect(safeNext(form.get("next")) ?? homeForRole(role));
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}
