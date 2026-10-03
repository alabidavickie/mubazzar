import "server-only";
import { createDb, runAs } from "./core";
import type { Db, DbActor, Queryable } from "./types-core";

export type { Db, DbActor, Queryable } from "./types-core";
export { DbError, parseAppError } from "./types-core";

/**
 * Process-wide database handle.
 * - DATABASE_URL set → Supabase Postgres via postgres.js
 * - otherwise → PGlite at PGLITE_DATA_DIR (default .data/pglite), auto-migrated and seeded when fresh.
 */
const globalForDb = globalThis as unknown as { __mubazzarDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__mubazzarDb) {
    globalForDb.__mubazzarDb = createDb().catch((err) => {
      globalForDb.__mubazzarDb = undefined;
      throw err;
    });
  }
  return globalForDb.__mubazzarDb;
}

/** Trusted server code only (cron, seed, order creation after validation). Bypasses RLS. */
export async function asService<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  return runAs(await getDb(), { kind: "service" }, fn);
}

/** Guest context: RLS policies for `anon` apply. */
export async function asAnon<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  return runAs(await getDb(), { kind: "anon" }, fn);
}

/** Signed-in user context: RLS policies for `authenticated` + the user's app role apply. */
export async function asUser<T>(userId: string, fn: (q: Queryable) => Promise<T>, email?: string | null): Promise<T> {
  return runAs(await getDb(), { kind: "user", userId, email }, fn);
}

export async function asActor<T>(actor: DbActor, fn: (q: Queryable) => Promise<T>): Promise<T> {
  return runAs(await getDb(), actor, fn);
}
