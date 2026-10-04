import "server-only";
import { createHash, randomInt, scryptSync, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { asService } from "../db";
import { env, services } from "../env";
import { notify } from "./notify";

/**
 * Auth adapter.
 * - Mock (default): users live in auth.users (local shim), passwords are scrypt hashes, sessions are
 *   HS256-signed HttpOnly cookies, OTP codes are hashed in auth.otp_codes and "sent" via notify().
 * - Live (Supabase keys present): Supabase Auth (password + OTP) via REST; we still issue our own
 *   signed session cookie after verifying with Supabase so RLS claims come from a trusted source.
 */

export const SESSION_COOKIE = "mbz_session";
/**
 * Readable "a session exists" hint (value "1", no identity) so static storefront pages know when to
 * run client-only work such as the server-cart sync. Never trusted: the server always reads the
 * signed HttpOnly session cookie.
 */
export const SIGNED_IN_HINT_COOKIE = "mbz_signed_in";
const SESSION_DAYS = 30;
const secret = () => new TextEncoder().encode(env.authSecret);

export interface SessionClaims {
  sub: string;
  email?: string | null;
}

export async function createSessionCookie(claims: SessionClaims): Promise<void> {
  const token = await new SignJWT({ email: claims.email ?? undefined })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  jar.set(SIGNED_IN_HINT_COOKIE, "1", { httpOnly: false, sameSite: "lax", secure: env.isProd, path: "/", maxAge: SESSION_DAYS * 86_400 });
}

export async function readSessionCookie(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, email: (payload.email as string | undefined) ?? null };
  } catch {
    return null;
  }
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_HINT_COOKIE);
}

// ─── Passwords (mock) ────────────────────────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored?.startsWith("scrypt$")) return false;
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

type AuthResult = { ok: true; userId: string; email: string | null } | { ok: false; error: string };

async function supabaseFetch(pathname: string, body: unknown, useServiceKey = false): Promise<Response> {
  return fetch(`${env.supabaseUrl}/auth/v1/${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: env.supabaseAnonKey,
      authorization: `Bearer ${useServiceKey ? env.supabaseServiceKey : env.supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  if (services.supabaseAuth) {
    const res = await supabaseFetch("token?grant_type=password", { email: normalized, password });
    if (!res.ok) return { ok: false, error: "Incorrect email or password" };
    const json = (await res.json()) as { user?: { id: string; email?: string } };
    if (!json.user) return { ok: false, error: "Incorrect email or password" };
    return { ok: true, userId: json.user.id, email: json.user.email ?? normalized };
  }
  const rows = await asService((q) =>
    q.query<{ id: string; email: string; encrypted_password: string | null }>(
      "select id, email, encrypted_password from auth.users where lower(email) = $1",
      [normalized],
    ),
  );
  const user = rows[0];
  // Always run a hash comparison to keep timing similar for unknown emails.
  const valid = verifyPassword(password, user?.encrypted_password ?? "scrypt$00$00");
  if (!user || !valid) return { ok: false, error: "Incorrect email or password" };
  await asService((q) => q.query("update auth.users set last_sign_in_at = now() where id = $1", [user.id]));
  return { ok: true, userId: user.id, email: user.email };
}

const otpHash = (identifier: string, code: string) =>
  createHash("sha256").update(`${env.authSecret}:${identifier}:${code}`).digest("hex");

/** Sends a 6-digit code to a phone (E.164) or email. Returns devCode only outside production. */
export async function requestOtp(identifier: string): Promise<{ ok: true; devCode?: string } | { ok: false; error: string }> {
  const isEmail = identifier.includes("@");
  if (services.supabaseAuth) {
    const res = await supabaseFetch("otp", isEmail ? { email: identifier, create_user: true } : { phone: identifier, create_user: true });
    return res.ok ? { ok: true } : { ok: false, error: "Could not send the code. Try again shortly." };
  }
  const code = env.mockOtpCode && !env.isProd ? env.mockOtpCode : String(randomInt(0, 1_000_000)).padStart(6, "0");
  await asService(async (q) => {
    await q.query("update auth.otp_codes set consumed_at = now() where identifier = $1 and consumed_at is null", [identifier]);
    await q.query(
      "insert into auth.otp_codes (identifier, code_hash, expires_at) values ($1, $2, now() + interval '10 minutes')",
      [identifier, otpHash(identifier, code)],
    );
  });
  await notify({
    channel: isEmail ? "email" : "sms",
    to: identifier,
    template: "otp",
    subject: "Your MUBAZZAR login code",
    body: `Your MUBAZZAR code is ${code}. It expires in 10 minutes. Never share it with anyone — MUBAZZAR staff will never ask for it.`,
  });
  return { ok: true, devCode: env.isProd ? undefined : code };
}

export async function verifyOtp(identifier: string, code: string, fullName?: string): Promise<AuthResult> {
  const isEmail = identifier.includes("@");
  if (services.supabaseAuth) {
    const res = await supabaseFetch("verify", isEmail ? { email: identifier, token: code, type: "email" } : { phone: identifier, token: code, type: "sms" });
    if (!res.ok) return { ok: false, error: "That code is wrong or has expired" };
    const json = (await res.json()) as { user?: { id: string; email?: string } };
    if (!json.user) return { ok: false, error: "That code is wrong or has expired" };
    return { ok: true, userId: json.user.id, email: json.user.email ?? null };
  }
  return asService(async (q) => {
    const rows = await q.query<{ id: string; code_hash: string; attempts: number }>(
      `select id, code_hash, attempts from auth.otp_codes
        where identifier = $1 and consumed_at is null and expires_at > now()
        order by created_at desc limit 1`,
      [identifier],
    );
    const row = rows[0];
    if (!row || row.attempts >= 5) return { ok: false as const, error: "That code is wrong or has expired" };
    if (row.code_hash !== otpHash(identifier, code.trim())) {
      await q.query("update auth.otp_codes set attempts = attempts + 1 where id = $1", [row.id]);
      return { ok: false as const, error: "That code is wrong or has expired" };
    }
    await q.query("update auth.otp_codes set consumed_at = now() where id = $1", [row.id]);
    const col = isEmail ? "email" : "phone";
    const existing = await q.query<{ id: string; email: string | null }>(
      `select id, email from auth.users where ${col} = $1`,
      [identifier],
    );
    if (existing[0]) return { ok: true as const, userId: existing[0].id, email: existing[0].email };
    const created = await q.query<{ id: string; email: string | null }>(
      `insert into auth.users (${col}, raw_user_meta_data) values ($1, $2) returning id, email`,
      [identifier, { full_name: fullName ?? null }],
    );
    return { ok: true as const, userId: created[0]!.id, email: created[0]!.email };
  });
}

/** Admin provisioning (staff, dispatchers, approved suppliers). Returns the new user id. */
export async function createUser(input: {
  email: string;
  phone?: string | null;
  password: string;
  fullName: string;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  if (services.supabaseAuth) {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: env.supabaseServiceKey,
        authorization: `Bearer ${env.supabaseServiceKey}`,
      },
      body: JSON.stringify({
        email,
        phone: input.phone ?? undefined,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.fullName },
      }),
    });
    if (!res.ok) return { ok: false, error: "Could not create the account (email may already exist)" };
    const json = (await res.json()) as { id: string };
    return { ok: true, userId: json.id };
  }
  try {
    const rows = await asService((q) =>
      q.query<{ id: string }>(
        `insert into auth.users (email, phone, encrypted_password, raw_user_meta_data) values ($1, $2, $3, $4) returning id`,
        [email, input.phone ?? null, hashPassword(input.password), { full_name: input.fullName }],
      ),
    );
    return { ok: true, userId: rows[0]!.id };
  } catch {
    return { ok: false, error: "An account with this email or phone already exists" };
  }
}
