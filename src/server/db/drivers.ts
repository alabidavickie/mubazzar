import type { Db, Queryable, SqlParam } from "./types-core";

// int8 → number (kobo fits comfortably in 2^53), numeric → number.
const INT8_OID = 20;
const NUMERIC_OID = 1700;

function toNumber(v: string | number | bigint | null): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === "number" ? v : Number(v);
}

export async function createPgliteDb(dataDir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = await PGlite.create({
    dataDir: dataDir === "memory" ? undefined : dataDir,
    parsers: {
      [INT8_OID]: (v: string) => toNumber(v),
      [NUMERIC_OID]: (v: string) => toNumber(v),
    },
  });

  const wrap = (q: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    exec: (sql: string) => Promise<unknown>;
  }): Queryable => ({
    async query<T>(sql: string, params: SqlParam[] = []) {
      const res = await q.query(sql, params.map(normaliseParam));
      return res.rows as T[];
    },
    async exec(sql: string) {
      await q.exec(sql);
    },
  });

  const base = wrap(pg);
  return {
    driver: "pglite",
    query: base.query,
    exec: base.exec,
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
    close: () => pg.close(),
  };
}

export async function createPostgresDb(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    prepare: false, // compatible with Supabase's transaction pooler (pgbouncer)
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 15,
    types: {
      bigint: { to: INT8_OID, from: [INT8_OID], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      numeric: { to: NUMERIC_OID, from: [NUMERIC_OID], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  });

  type Unsafe = { unsafe: (q: string, p?: never[]) => Promise<unknown> & { simple?: () => Promise<unknown> } };
  const wrap = (q: Unsafe): Queryable => ({
    async query<T>(text: string, params: SqlParam[] = []) {
      const rows = await q.unsafe(text, params.map(normaliseParam) as never[]);
      return [...(rows as T[])];
    },
    async exec(text: string) {
      const r = q.unsafe(text);
      await (r.simple ? r.simple() : r);
    },
  });

  const base = wrap(sql as unknown as Unsafe);
  return {
    driver: "postgres",
    query: base.query,
    exec: base.exec,
    transaction: (fn) => sql.begin((tx) => fn(wrap(tx as unknown as Unsafe))) as Promise<never>,
    close: () => sql.end({ timeout: 5 }),
  };
}

function normaliseParam(p: SqlParam): unknown {
  if (p instanceof Date) return p.toISOString();
  if (typeof p === "bigint") return p.toString();
  if (p !== null && typeof p === "object" && !Array.isArray(p)) return JSON.stringify(p);
  return p;
}
