import type { Metadata } from "next";
import { requireRole } from "@/server/session";
import { asUser } from "@/server/db";
import { getSettingsMap } from "@/server/services/admin-settings";
import { SettingForm } from "@/components/admin/setting-form";
import { ChannelForm, type ChannelValues } from "@/components/admin/admin-records";

export const metadata: Metadata = { title: "Chat & payments" };

export default async function ChatPaymentsSettings() {
  const session = await requireRole(["admin"], "/admin/chat-payments");
  const [channels, hubs] = await asUser(session.userId, async (q) => [
    await q.query<ChannelValues>(
      `select id, kind, label, handle, hub_code as "hubCode", weight, is_enabled as "isEnabled", sort_order as "sortOrder" from public.chat_channels order by sort_order, created_at`,
    ),
    await q.query<{ code: string; name: string }>("select code, name from public.hubs where is_active order by sort_order"),
  ]);
  const s = await getSettingsMap(session, ["whatsapp_routing", "chat_templates", "bank_accounts", "auto_cancel_hours", "follow_up_after_hours", "admin_alerts"]);
  const alerts = (s.admin_alerts ?? {}) as { emails?: string[]; phones?: string[] };
  const tpl = "Placeholders: {order_number} {items} {subtotal} {delivery} {total} {state} {customer_name} {first_name} {address} {city} {phone}";
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-headline-md font-bold text-navy">Chat &amp; payments</h1>
      <section className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-card" aria-label="Chat channels">
        <h2 className="text-label-lg font-bold text-navy">Chat channels</h2>
        <p className="text-body-sm text-ink-muted">Customers only see enabled channels. WhatsApp numbers can be tied to a hub (routing below).</p>
        {channels.map((c) => (
          <ChannelForm key={c.id} initial={c} hubs={hubs} />
        ))}
        <h3 className="pt-2 text-label-md font-bold text-navy">Add a channel</h3>
        <ChannelForm initial={{ id: null, kind: "whatsapp", label: "", handle: "", hubCode: null, weight: 1, isEnabled: true, sortOrder: channels.length + 1 }} hubs={hubs} />
      </section>
      <SettingForm
        settingKey="whatsapp_routing"
        title="WhatsApp routing"
        kind="scalar"
        fields={[{ name: "_", label: "Which number gets each order", type: "select", options: [{ value: "by_hub", label: "By the hub that ships it" }, { value: "round_robin", label: "Round robin (weighted)" }, { value: "first", label: "Always the first enabled number" }] }]}
        initial={s.whatsapp_routing}
      />
      <SettingForm
        settingKey="bank_accounts"
        title="Bank accounts (staff only)"
        hint="Staff copy these into chat. Never shown on public pages."
        kind="list"
        maxItems={5}
        fields={[{ name: "bank", label: "Bank" }, { name: "accountName", label: "Account name" }, { name: "accountNumber", label: "Account number" }]}
        initial={s.bank_accounts}
      />
      <SettingForm
        settingKey="chat_templates"
        title="Message templates"
        hint={`Leave empty to use the default. ${tpl}`}
        kind="object"
        fields={[
          { name: "customer_order", label: "Customer → us (WhatsApp prefill)", type: "textarea" },
          { name: "staff_greeting", label: "Staff greeting", type: "textarea" },
          { name: "staff_confirmation", label: "Staff confirmation", type: "textarea" },
          { name: "dispatch_contact", label: "Rider message", type: "textarea" },
        ]}
        initial={s.chat_templates}
      />
      <SettingForm settingKey="auto_cancel_hours" title="Auto-cancel unpaid orders after (hours)" kind="scalar" fields={[{ name: "_", label: "Hours", type: "number" }]} initial={s.auto_cancel_hours} />
      <SettingForm settingKey="follow_up_after_hours" title="Show in staff follow-up list after (hours)" kind="scalar" fields={[{ name: "_", label: "Hours", type: "number" }]} initial={s.follow_up_after_hours} />
      <SettingForm
        settingKey="admin_alerts"
        title="New-order alerts"
        kind="object"
        fields={[{ name: "emails", label: "Emails (comma separated)" }, { name: "phones", label: "SMS numbers (comma separated)" }]}
        initial={{ emails: (alerts.emails ?? []).join(", "), phones: (alerts.phones ?? []).join(", ") }}
      />
    </div>
  );
}
