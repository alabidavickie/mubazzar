import type { Metadata } from "next";
import Link from "next/link";
import { StandardSection } from "@/components/commerce/standard-section";
import { HelpCard, ProseSection, StaticBody, StaticHero } from "@/components/storefront/static-page";
import { getPublicSettings } from "@/server/services/settings";
import { getHubs } from "@/server/services/storefront";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "About MUBAZZAR — The MUBAZZAR Standard",
  description:
    "MUBAZZAR finds uncommon gadgets and viral problem solvers, tests every batch before dispatch and delivers across Nigeria. No card details online — order, then chat with us.",
  alternates: { canonical: "/about" },
};

const STEPS = [
  { icon: "shopping_bag", title: "Pick your gadget", body: "Browse tested products, choose a bundle and fill a short delivery form. No account needed." },
  { icon: "chat", title: "Confirm in chat", body: "Our team confirms your order on WhatsApp (or your chosen app) and shares official payment details." },
  { icon: "local_shipping", title: "Receive & enjoy", body: "We dispatch from the nearest hub. Pay on Delivery can be arranged in chat for eligible areas." },
];

export default async function AboutPage() {
  const [settings, hubs] = await Promise.all([getPublicSettings(), getHubs()]);
  return (
    <>
      <StaticHero
        eyebrow="Our story"
        icon="verified"
        title="Uncommon gadgets. Tested before they reach you."
        intro={
          <p>
            MUBAZZAR is a Nigerian store for clever, hard-to-find gadgets — car tech, kitchen hacks, solar backups and everyday
            problem solvers — sourced directly and checked by our team before dispatch.
          </p>
        }
      />
      <StaticBody>
        <ProseSection title="Why we exist" icon="rocket_launch">
          <p>
            Viral gadgets look great in videos, but many Nigerian shoppers have paid for something that arrived broken, fake or
            nothing like the advert. We started MUBAZZAR to fix that: a short list of genuinely useful products, honest prices,
            and real people you can talk to before and after you buy.
          </p>
          <p>
            We don&apos;t list a product until it passes our stress test, and we never show invented stock levels, fake countdowns
            or made-up reviews. If a timer is on the page, it ends when the deal really ends.
          </p>
        </ProseSection>

        <ProseSection title="How ordering works" icon="task_alt">
          <ol className="grid list-none! gap-2 pl-0! sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded-lg bg-surface-low p-3 pl-3!">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-label-md font-bold text-gold-pale">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-label-md font-bold text-navy">{s.title}</span>
                  <span className="block text-body-sm text-ink-muted">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <p>
            We never collect card numbers, PINs or OTPs on this website. Payment is only ever arranged with our staff in chat,
            to MUBAZZAR&apos;s official account.
          </p>
        </ProseSection>

        {hubs.length ? (
          <ProseSection title="Where we ship from" icon="storefront">
            <ul>
              {hubs.map((h) => (
                <li key={h.code}>
                  <strong>{h.name}</strong>
                  {h.code === "warehouse" ? " — central stock for nationwide dispatch" : " — same-day delivery within the city"}
                </li>
              ))}
            </ul>
            <p>
              See fees and delivery times for every state on our <Link href="/delivery">Delivery page</Link>.
            </p>
          </ProseSection>
        ) : null}
      </StaticBody>

      <StandardSection detailed />

      <StaticBody>
        <HelpCard settings={settings} />
        <p className="text-center text-body-sm text-ink-muted">
          {settings.business.legalName} · {settings.business.address}
        </p>
      </StaticBody>
    </>
  );
}
