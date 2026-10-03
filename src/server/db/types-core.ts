/** Minimal driver-agnostic database interface shared by the PGlite and postgres.js drivers. */

export type SqlParam = string | number | boolean | null | Date | bigint | string[] | number[] | Record<string, unknown> | unknown[];

export interface Queryable {
  /** Parameterised query ($1, $2 …). Returns rows. */
  query<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  /** Execute one or more statements without parameters (DDL, scripts). */
  exec(sql: string): Promise<void>;
}

export interface Db extends Queryable {
  /** Run fn inside a transaction; rolls back on throw. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly driver: "pglite" | "postgres";
}

/** Who the query runs as. Mirrors how Supabase PostgREST sets role + JWT claims. */
export type DbActor =
  | { kind: "service" }
  | { kind: "anon" }
  | { kind: "user"; userId: string; email?: string | null };

export class DbError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly appCode: string | undefined,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "DbError";
  }
}

/**
 * Our SQL functions raise exceptions like 'OUT_OF_STOCK:Turbo Car Vacuum' (P0001) and
 * 'FORBIDDEN' (42501). This extracts the app code and optional argument.
 */
export function parseAppError(err: unknown): { appCode: string; arg?: string; pgCode?: string } | null {
  const e = err as { message?: string; code?: string };
  if (!e || typeof e.message !== "string") return null;
  const m = /^([A-Z_]{3,})(?::(.*))?$/.exec(e.message.trim());
  if (m) return { appCode: m[1]!, arg: m[2], pgCode: e.code };
  if (e.code === "42501" || /row-level security|permission denied/i.test(e.message)) {
    return { appCode: "FORBIDDEN", pgCode: e.code };
  }
  return null;
}
