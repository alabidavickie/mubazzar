import type { Metadata } from "next";
import { requireRole } from "@/server/session";
import { getSettingsMap } from "@/server/services/admin-settings";
import { SettingForm } from "@/components/admin/setting-form";

export const metadata: Metadata = { title: "Homepage & store info" };

export default async function HomepageSettings() {
  const session = await requireRole(["admin"], "/admin/homepage");
  const s = await getSettingsMap(session, ["promo_strip", "hero", "trust_bar", "flash_section", "show_sample_reviews", "support", "business"]);
  const tone = [{ value: "emerald", label: "emerald" }, { value: "gold", label: "gold" }];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-headline-md font-bold text-navy">Homepage &amp; store info</h1>
      <SettingForm settingKey="promo_strip" title="Announcement strip" kind="scalar" fields={[{ name: "_", label: "Text", hint: "Separate messages with |" }]} initial={s.promo_strip} />
      <SettingForm
        settingKey="hero"
        title="Hero banner"
        hint="{max_discount} is replaced with the real biggest discount among live products."
        kind="object"
        fields={[
          { name: "badge", label: "Badge" },
          { name: "badgeNote", label: "Badge note" },
          { name: "headline", label: "Headline" },
          { name: "highlight", label: "Highlighted words" },
          { name: "subtext", label: "Subtext", type: "textarea" },
          { name: "ctaLabel", label: "Button text" },
          { name: "ctaHref", label: "Button link", hint: "e.g. /deals" },
          { name: "imageUrl", label: "Image URL (optional)" },
        ]}
        initial={s.hero}
      />
      <SettingForm settingKey="trust_bar" title="Trust strip" kind="list" fields={[{ name: "icon", label: "Icon" }, { name: "text", label: "Text" }, { name: "tone", label: "Colour", type: "select", options: tone }]} initial={s.trust_bar} />
      <SettingForm settingKey="flash_section" title="Flash deals section" kind="object" fields={[{ name: "title", label: "Title" }, { name: "subtitle", label: "Subtitle" }]} initial={s.flash_section} />
      <SettingForm
        settingKey="show_sample_reviews"
        title="Sample reviews"
        hint="Seeded sample reviews (always labelled). Turn OFF in production."
        kind="scalar"
        fields={[{ name: "_", label: "Show labelled sample reviews", type: "checkbox" }]}
        initial={s.show_sample_reviews}
      />
      <SettingForm
        settingKey="support"
        title="Customer support"
        kind="object"
        fields={[{ name: "whatsapp", label: "Support WhatsApp" }, { name: "phone", label: "Helpline" }, { name: "hours", label: "Hours" }, { name: "email", label: "Email" }]}
        initial={s.support}
      />
      <SettingForm
        settingKey="business"
        title="Business details (footer)"
        kind="object"
        fields={[
          { name: "legalName", label: "Legal name" },
          { name: "address", label: "Address" },
          { name: "cac", label: "CAC number", hint: "Only a real RC/BN number; leave empty until registered" },
          { name: "returnsDays", label: "Returns window (days)", type: "number" },
        ]}
        initial={s.business}
      />
    </div>
  );
}
