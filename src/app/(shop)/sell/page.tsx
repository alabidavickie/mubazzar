import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Accordion } from "@/components/ui/misc";
import { HelpCard, ProseSection, StaticBody } from "@/components/storefront/static-page";
import { getCategories } from "@/server/services/catalog";
import { getPublicSettings } from "@/server/services/settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Become a Supplier — Sell on MUBAZZAR",
  description:
    "Got unique or viral products? Partner with MUBAZZAR: zero listing fees, we handle customer chat, payment collection and nationwide delivery.",
  alternates: { canonical: "/sell" },
};

const BENEFITS = [
  { icon: "storefront", title: "Zero listing fees", body: "You only earn when your product sells — no upfront fees to list." },
  { icon: "support_agent", title: "We handle the chat", body: "Our WhatsApp team confirms orders, answers questions and collects payment." },
  { icon: "local_shipping", title: "Nationwide delivery", body: "Stock your items in our Lagos or Abuja hubs and we ship to all 36 states + FCT." },
  { icon: "analytics", title: "See your sales", body: "Your supplier dashboard shows submissions, approvals, stock and sales." },
];

const STEPS = [
  { title: "Apply", body: "Tell us about your business and the products you want to sell. Share photos or links." },
  { title: "Product review", body: "Our team checks samples against the MUBAZZAR Standard: function, durability and honest claims." },
  { title: "Go live", body: "Approved products are photographed, priced with you and listed — often with a dedicated ad landing page." },
  { title: "Get paid", body: "Payouts for delivered orders are settled on the schedule in your supplier agreement." },
];

const FAQS = [
  {
    question: "What kind of products do you accept?",
    answer:
      "Useful, uncommon gadgets and problem solvers that work as advertised — car accessories, kitchen tools, solar and power backups, smart home and security gadgets. We don't accept counterfeit goods, medicines, cosmetics or anything unsafe.",
  },
  {
    question: "Do I need a registered business?",
    answer: "A CAC registration helps and is required before payouts, but you can apply while it's in progress — tell us in your application.",
  },
  {
    question: "Who sets the selling price?",
    answer: "We agree the price with you based on landed cost, competitor prices and delivery. Discounts shown to buyers are always real.",
  },
  {
    question: "How long does approval take?",
    answer: "We aim to reply to every application within 5 working days. Sample testing can take longer for complex products.",
  },
];

export default async function SellPage() {
  const [settings, categories] = await Promise.all([getPublicSettings(), getCategories()]);
  return (
    <>
      <div className="px-4 pt-3">
        <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-gold-soft to-gold-pale p-5 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="rounded bg-bronze-ink px-2 py-0.5 text-label-sm font-extrabold text-gold-pale uppercase">Supplier Hub</span>
              <h1 className="mt-2 font-display text-headline-xl font-bold text-bronze-ink">Got unique or viral products?</h1>
              <p className="mt-1 text-body-md text-bronze-muted">
                Partner with MUBAZZAR and reach buyers across Nigeria. We handle chat, payment collection and delivery — you focus
                on great products.
              </p>
            </div>
            <Icon name="handshake" className="hidden text-5xl text-bronze-ink/30 xs:block" />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/sell/apply"
              data-testid="sell-apply"
              className="inline-flex min-h-12 items-center gap-1 rounded-lg bg-navy px-5 text-label-lg text-on-dark shadow-card hover:opacity-90"
            >
              Apply to Sell <Icon name="arrow_forward" className="text-base" />
            </Link>
            <Link href="/login" className="inline-flex min-h-12 items-center gap-1 rounded-lg bg-card/70 px-5 text-label-lg text-bronze-ink">
              Supplier sign in
            </Link>
          </div>
        </div>
      </div>

      <StaticBody>
        <section aria-labelledby="benefits-title" className="flex flex-col gap-2">
          <h2 id="benefits-title" className="text-headline-md font-bold text-navy">
            Why sell with MUBAZZAR
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex items-start gap-3 rounded-xl bg-card p-4 shadow-card">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-container text-bronze">
                  <Icon name={b.icon} className="text-2xl" />
                </span>
                <span>
                  <span className="block text-label-lg font-bold text-navy">{b.title}</span>
                  <span className="block text-body-md text-ink-muted">{b.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="steps-title" className="flex flex-col gap-2">
          <h2 id="steps-title" className="text-headline-md font-bold text-navy">
            How it works
          </h2>
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded-xl bg-surface-low p-3 shadow-card">
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
        </section>

        {categories.length ? (
          <ProseSection title="Categories we're sourcing" icon="category">
            <ul className="flex list-none! flex-wrap gap-2 pl-0!">
              {categories.map((c) => (
                <li key={c.slug} className="rounded-full bg-surface-high px-3 py-1 pl-3! text-label-md text-navy">
                  {c.emoji ? <span aria-hidden>{c.emoji} </span> : null}
                  {c.name}
                </li>
              ))}
            </ul>
          </ProseSection>
        ) : null}

        <section aria-labelledby="sell-faq" className="flex flex-col gap-2">
          <h2 id="sell-faq" className="text-headline-md font-bold text-navy">
            Supplier questions
          </h2>
          <Accordion items={FAQS} />
        </section>

        <div className="flex flex-col items-center gap-2 rounded-xl bg-navy p-5 text-center text-on-dark shadow-raised">
          <h2 className="text-headline-sm font-bold">Ready to reach more Nigerian buyers?</h2>
          <Link
            href="/sell/apply"
            className="inline-flex min-h-12 items-center gap-1 rounded-lg bg-gold-soft px-6 text-label-lg text-bronze-ink shadow-card"
          >
            Start your application <Icon name="arrow_forward" className="text-base" />
          </Link>
        </div>

        <HelpCard settings={settings} message="Hello MUBAZZAR, I'd like to become a supplier." />
      </StaticBody>
    </>
  );
}
