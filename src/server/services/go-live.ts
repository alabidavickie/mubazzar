import "server-only";
import { asUser } from "../db";
import { env, services } from "../env";
import type { Session } from "../session";
import { getSettingsMap } from "./admin-settings";
import { goLiveChecks, type GoLiveItem } from "@/lib/go-live";

/** What is still demo/test configuration (admin dashboard "Before you go live" panel). Admin only. */
export async function getGoLiveChecks(session: Session): Promise<GoLiveItem[]> {
  if (session.role !== "admin") return [];
  const [s, channels] = await Promise.all([
    getSettingsMap(session, ["support", "bank_accounts", "admin_alerts", "show_sample_reviews", "business"]),
    asUser(session.userId, (q) => q.query<{ handle: string }>("select handle from public.chat_channels where is_enabled and kind = 'whatsapp'")),
  ]);
  const support = (s.support ?? {}) as { whatsapp?: string };
  const alerts = (s.admin_alerts ?? {}) as { emails?: string[]; phones?: string[] };
  const business = (s.business ?? {}) as { cac?: string | null };
  return goLiveChecks({
    supportWhatsapp: support.whatsapp ?? "",
    enabledChannelHandles: channels.map((c) => c.handle),
    bankAccounts: Array.isArray(s.bank_accounts) ? (s.bank_accounts as { accountNumber: string }[]) : [],
    adminAlerts: { emails: alerts.emails ?? [], phones: alerts.phones ?? [] },
    showSampleReviews: s.show_sample_reviews === true,
    cac: business.cac ?? null,
    siteUrl: env.siteUrl,
    services,
  });
}
