import type { Metadata } from "next";
import { requireRole } from "@/server/session";
import { asUser } from "@/server/db";
import { getSettingsMap } from "@/server/services/admin-settings";
import { koboToNairaInput } from "@/lib/money";
import { SettingForm } from "@/components/admin/setting-form";
import { ZoneRow, type ZoneValues } from "@/components/admin/admin-records";

export const metadata: Metadata = { title: "Delivery zones" };

export default async function DeliverySettings() {
  const session = await requireRole(["admin"], "/admin/delivery");
  const [zones, hubs] = await asUser(session.userId, async (q) => [
    await q.query<Omit<ZoneValues, "fee"> & { feeKobo: number }>(
      `select state, display_name as "displayName", fee_kobo as "feeKobo", eta_min_days as "etaMinDays", eta_max_days as "etaMaxDays",
              same_day_enabled as "sameDayEnabled", hub_code as "hubCode", is_active as "isActive" from public.delivery_zones order by sort_order, state`,
    ),
    await q.query<{ code: string; name: string }>("select code, name from public.hubs where is_active order by sort_order"),
  ]);
  const s = await getSettingsMap(session, ["same_day_cutoff"]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-headline-md font-bold text-navy">Delivery zones</h1>
      <SettingForm settingKey="same_day_cutoff" title="Same-day cut-off (Lagos time)" hint="Orders before this time ship the same day where same-day is on." kind="scalar" fields={[{ name: "_", label: "Cut-off", type: "time" }]} initial={s.same_day_cutoff} />
      <div className="overflow-x-auto rounded-xl bg-card shadow-card" tabIndex={0} role="region" aria-label="Fees and delivery days per state">
        <table className="w-full min-w-[720px] text-body-md">
          <thead>
            <tr className="border-b border-line text-left text-label-sm text-ink-muted uppercase">
              <th className="p-2">State</th>
              <th className="p-2">Fee (₦)</th>
              <th className="p-2">Days</th>
              <th className="p-2">Ships from</th>
              <th className="p-2">Same-day</th>
              <th className="p-2">Active</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <ZoneRow key={z.state} initial={{ ...z, fee: koboToNairaInput(Number(z.feeKobo)) }} hubs={hubs} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
