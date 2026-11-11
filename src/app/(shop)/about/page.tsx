import type { Metadata } from "next";
import { HelpCard, ProseSection, StaticBody, StaticHero } from "@/components/storefront/static-page";
import { getPublicSettings } from "@/server/services/settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "About MUBAZZAR",
  description: "MUBAZZAR is a Nigerian store for uncommon gadgets. No card details online: order on the site, confirm on WhatsApp, and pay on delivery.",
  alternates: { canonical: "/about" },
};

const STEPS = [
  { title: "Pick your gadget", body: "Choose a product and fill a short delivery form. No account needed." },
  { title: "Confirm on WhatsApp", body: "We message you to confirm your order, the delivery fee and when it will arrive." },
  { title: "Pay on delivery", body: "Check your item when it arrives, then pay. Pay on Delivery is arranged in the chat." },
];

export default async function AboutPage() {
  const settings = await getPublicSettings();
  return (
    <>
      <StaticHero
        eyebrow="About us"
        icon="storefront"
        title="Uncommon gadgets, delivered across Nigeria"
        intro={<p>MUBAZZAR is a Nigerian store for clever, hard-to-find gadgets: car tech, kitchen tools, solar and power, and everyday problem solvers.</p>}
      />
      <StaticBody>
        <ProseSection title="How ordering works" icon="task_alt">
          <ol className="grid list-none! gap-2 pl-0! sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded-lg bg-surface-low p-3 pl-3!">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-label-md font-bold text-gold-pale">{i + 1}</span>
                <span>
                  <span className="block text-label-md font-bold text-navy">{s.title}</span>
                  <span className="block text-body-sm text-ink-muted">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <p>We never collect card numbers, PINs or OTPs on this website. Payment is only ever arranged with us in the chat.</p>
        </ProseSection>

        <HelpCard settings={settings} />
        <p className="text-center text-body-sm text-ink-muted">MUBAZZAR · {settings.business.address}</p>
      </StaticBody>
    </>
  );
}
