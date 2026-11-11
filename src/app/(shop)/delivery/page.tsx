import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { HelpCard, ProseSection, StaticBody, StaticHero } from "@/components/storefront/static-page";
import { getDeliveryZones, getPublicSettings } from "@/server/services/settings";
import { deliveryFeeText, etaLabel } from "@/lib/delivery";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Delivery & Pay on Delivery",
  description: "How MUBAZZAR delivers across Nigeria: your delivery fee and time are confirmed with you on WhatsApp, and you can pay on delivery.",
  alternates: { canonical: "/delivery" },
};

export default async function DeliveryPage() {
  const [zones, settings] = await Promise.all([getDeliveryZones(), getPublicSettings()]);
  // Only states the owner has set a real fee or time for are listed; the rest are agreed in chat.
  const priced = zones.filter((z) => z.feeKobo > 0 || z.etaMaxDays > 0);

  return (
    <>
      <StaticHero
        eyebrow="Delivery"
        icon="local_shipping"
        title="Delivery & Pay on Delivery"
        intro={<p>We deliver across Nigeria. Your delivery fee and delivery time depend on your address, so we confirm both with you on WhatsApp before you pay anything.</p>}
      />
      <StaticBody>
        <ProseSection id="fees" title="Delivery fee and time" icon="local_shipping">
          <p>
            After you place your order, we message you on WhatsApp with the delivery fee and when it will arrive at your address. You
            only go ahead if you are happy with both.
          </p>
        </ProseSection>

        {priced.length > 0 ? (
          <section aria-labelledby="fees-title" className="rounded-xl bg-card p-4 shadow-card">
            <h2 id="fees-title" className="mb-3 text-headline-sm font-bold text-navy">
              Fees by state
            </h2>
            <div className="-mx-4 overflow-x-auto px-4" tabIndex={0} role="region" aria-label="Delivery fees table">
              <table className="w-full min-w-[22rem] text-left text-body-md" data-testid="zones-table">
                <caption className="sr-only">Delivery fee and estimated time for each state</caption>
                <thead>
                  <tr className="border-b border-line text-label-sm text-ink-muted">
                    <th scope="col" className="py-2 pr-2">
                      State
                    </th>
                    <th scope="col" className="py-2 pr-2">
                      Fee
                    </th>
                    <th scope="col" className="py-2">
                      Delivery time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {priced.map((z) => (
                    <tr key={z.state} className="border-b border-line-soft last:border-0">
                      <th scope="row" className="py-2 pr-2 font-semibold text-navy">
                        {z.displayName}
                      </th>
                      <td className="py-2 pr-2 font-bold text-ink tabular">{deliveryFeeText(z.feeKobo)}</td>
                      <td className="py-2 text-ink">{etaLabel({ sameDay: false, etaMinDays: z.etaMinDays, etaMaxDays: z.etaMaxDays })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <ProseSection id="pod" title="How Pay on Delivery works" icon="payments">
          <ol>
            <li>Place your order on the website. There is no payment step on the site.</li>
            <li>
              We message you on WhatsApp. Ask for <strong>Pay on Delivery</strong> there.
            </li>
            <li>We confirm whether Pay on Delivery is available for your address, and tell you before anything is sent.</li>
            <li>When the rider arrives, check the item, then pay by cash, transfer or POS.</li>
          </ol>
          <p className="flex items-start gap-1.5 rounded-lg bg-emerald-soft p-2.5 text-body-sm text-emerald-ink">
            <Icon name="lock" className="mt-0.5 shrink-0 text-sm" />
            MUBAZZAR staff and riders will never ask for your card PIN, OTP or BVN.
          </p>
        </ProseSection>

        <ProseSection id="tips" title="Tips for a smooth delivery" icon="task_alt">
          <ul>
            <li>Use an active WhatsApp number. The rider calls or messages before arriving.</li>
            <li>Add a landmark or bus stop so the rider finds you faster.</li>
            <li>
              You can check progress any time on <Link href="/track">Track My Order</Link>.
            </li>
          </ul>
        </ProseSection>

        <HelpCard settings={settings} message="Hello MUBAZZAR, I have a question about delivery." />
      </StaticBody>
    </>
  );
}
