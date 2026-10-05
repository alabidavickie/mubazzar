import "server-only";
import { asUser } from "../db";
import type { Session } from "../session";

/** Raw settings values for the admin editors (RLS: staff read private keys, admin writes). */
export async function getSettingsMap(session: Session, keys: string[]): Promise<Record<string, unknown>> {
  const rows = await asUser(session.userId, (q) =>
    q.query<{ key: string; value: unknown }>("select key, value from public.settings where key = any($1::text[])", [keys]),
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
