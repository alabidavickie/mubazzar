/**
 * Compatibility with a database that has not had migration 20261006000500_security_hardening.sql
 * applied yet (deploys can briefly run ahead of `supabase db push`). Kept free of server-only imports
 * so integration tests can run these statements against PGlite.
 */

/** Session lookup with sign-out revocation (needs profiles.sessions_revoked_at). */
export const PROFILE_SQL = `select id, role, full_name, email, phone, is_active,
              floor(extract(epoch from sessions_revoked_at))::bigint as revoked_at
         from public.profiles where id = $1`;

/** The same lookup for a database without that column: nobody is treated as revoked. */
export const LEGACY_PROFILE_SQL = `select id, role, full_name, email, phone, is_active, null::bigint as revoked_at
         from public.profiles where id = $1`;

/** Postgres "undefined_column" — what a missing migration looks like at runtime. */
export const isMissingColumn = (e: unknown) => (e as { code?: string } | null)?.code === "42703";

/** True when the database has the columns this version of the app needs. */
export const SCHEMA_CURRENT_SQL = `select exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'profiles' and column_name = 'sessions_revoked_at') as ok`;
