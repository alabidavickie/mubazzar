import type { Metadata } from "next";
import Link from "next/link";
import { HelpCard, ProseSection, StaticBody, StaticHero } from "@/components/storefront/static-page";
import { getPublicSettings } from "@/server/services/settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Returns & Refund Policy",
  description: "How to return a faulty or wrong item to MUBAZZAR, how swaps and refunds work, and what isn't covered.",
  alternates: { canonical: "/returns" },
};

export default async function ReturnsPage() {
  const settings = await getPublicSettings();
  const days = settings.business.returnsDays;
  return (
    <>
      <StaticHero
        eyebrow="Policy"
        icon="currency_exchange"
        title="Returns & Refund Policy"
        intro={
          <p>
            Every item is tested before dispatch. If something still goes wrong, tell us within <strong className="text-on-dark">{days} days</strong>{" "}
            of delivery and we&apos;ll make it right.
          </p>
        }
      />
      <StaticBody>
        <ProseSection title="What you can return" icon="task_alt">
          <ul>
            <li>
              <strong>Faulty items</strong> — it doesn&apos;t power on, doesn&apos;t work as described, or develops a fault within {days} days.
            </li>
            <li>
              <strong>Wrong items</strong> — you received a different product, colour or bundle from what you confirmed in chat.
            </li>
            <li>
              <strong>Damaged in transit</strong> — please show the rider and take photos before signing, or tell us the same day.
            </li>
          </ul>
          <p>
            Products with a longer warranty (shown on the product page) are covered for repair or replacement for the full warranty
            period after the {days}-day return window.
          </p>
        </ProseSection>

        <ProseSection title="How to start a return" icon="chat">
          <ol>
            <li>Message us on WhatsApp with your order number (e.g. MBZ-7K2QPA).</li>
            <li>Send a short video or photos showing the problem.</li>
            <li>We arrange pickup or tell you the nearest hub drop-off. In Lagos and Abuja we usually collect within 1–2 working days.</li>
            <li>Once our team inspects the item, we swap it or refund you — your choice where stock allows.</li>
          </ol>
        </ProseSection>

        <ProseSection title="Refunds" icon="payments">
          <p>
            Approved refunds are paid by bank transfer to the account you paid from, usually within 3–5 working days of inspection.
            If you paid the rider in cash, we refund by transfer to an account in your name. If the fault is ours, we also refund the
            delivery fee.
          </p>
          <p>Every refund is recorded against your order number, and you&apos;ll see the status when you track your order.</p>
        </ProseSection>

        <ProseSection title="What isn't covered" icon="info">
          <ul>
            <li>Damage from misuse, water (unless the product is rated waterproof), power surges or opening the device.</li>
            <li>Change-of-mind returns on hygiene items (e.g. earbuds, anti-snore devices) once the seal is broken.</li>
            <li>Missing parts reported after the {days}-day window.</li>
          </ul>
          <p>
            Changed your mind before dispatch? Just tell us in chat — you can cancel for free. See also our{" "}
            <Link href="/terms">Terms of Service</Link>.
          </p>
        </ProseSection>

        <HelpCard settings={settings} message="Hello MUBAZZAR, I'd like help with a return. My order number is " />
      </StaticBody>
    </>
  );
}
