import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { HelpCard, OnThisPage, ProseSection, StaticBody, StaticHero } from "@/components/storefront/static-page";
import { getDeliveryZones, getPublicSettings } from "@/server/services/settings";
import { getHubs } from "@/server/services/storefront";
import { formatNaira } from "@/lib/money";
import { formatCutoff } from "@/lib/time";
import { etaLabel } from "@/lib/delivery";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Delivery & Pay on Delivery",
  description:
    "Delivery fees and times for all 36 states and the FCT, same-day delivery in Lagos and Abuja, and how Pay on Delivery is arranged in chat.",
  alternates: { canonical: "/delivery" },
};

export default async function DeliveryPage() {
  const [zones, settings, hubs] = await Promise.all([getDeliveryZones(), getPublicSettings(), getHubs()]);
  const cutoff = formatCutoff(settings.sameDayCutoff);
  const sameDay = zones.filter((z) => z.sameDayEnabled);
  const hubName = new Map(hubs.map((h) => [h.code, h.name.replace(/\s*\(.*\)\s*$/, "")]));

  return (
    <>
      <StaticHero
        eyebrow="Delivery"
        icon="local_shipping"
        title="Delivery & Pay on Delivery"
        intro={
          <p>
            We deliver to all {zones.length} delivery zones in Nigeria.
            {sameDay.length ? ` Same-day in ${sameDay.map((z) => z.displayName).join(" and ")} when your order is confirmed before ${cutoff}.` : ""}
          </p>
        }
      />
      <StaticBody>
        <OnThisPage
          links={[
            { href: "#same-day", label: "Same-day" },
            { href: "#fees", label: "Fees by state" },
            { href: "#pod", label: "Pay on Delivery" },
            { href: "#tips", label: "Delivery tips" },
          ]}
        />

        <ProseSection id="same-day" title="Same-day delivery" icon="bolt">
          <p>
            Orders to {sameDay.length ? sameDay.map((z) => z.displayName).join(" and ") : "our hub cities"} that are confirmed in chat
            before <strong>{cutoff}</strong> (Lagos time) leave our hub the same day. After the cut-off, they go out first thing the
            next working day. The order form shows whether same-day is still possible when you choose your state.
          </p>
        </ProseSection>

        <section id="fees" aria-labelledby="fees-title" className="scroll-mt-32 rounded-xl bg-card p-4 shadow-card">
          <h2 id="fees-title" className="mb-1 text-headline-sm font-bold text-navy">
            Fees and delivery times by state
          </h2>
          <p className="mb-3 text-body-sm text-ink-muted">
            The fee is charged once per order. Times are in working days after your order is confirmed.
          </p>
          <div className="-mx-4 overflow-x-auto px-4" tabIndex={0} role="region" aria-label="Delivery fees table">
            <table className="w-full min-w-[30rem] text-left text-body-md" data-testid="zones-table">
              <caption className="sr-only">Delivery fee, estimated time and dispatch hub for each state</caption>
              <thead>
                <tr className="border-b border-line text-label-sm text-ink-muted uppercase">
                  <th scope="col" className="py-2 pr-2">
                    State
                  </th>
                  <th scope="col" className="py-2 pr-2">
                    Fee
                  </th>
                  <th scope="col" className="py-2 pr-2">
                    Delivery time
                  </th>
                  <th scope="col" className="py-2">
                    Ships from
                  </th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.state} className="border-b border-line-soft last:border-0">
                    <th scope="row" className="py-2 pr-2 font-semibold text-navy">
                      {z.displayName}
                    </th>
                    <td className="py-2 pr-2 font-bold text-ink tabular">{z.feeKobo === 0 ? "Free" : formatNaira(z.feeKobo)}</td>
                    <td className="py-2 pr-2 text-ink">
                      {z.sameDayEnabled ? (
                        <span className="flex flex-col">
                          <span className="font-semibold text-emerald-ink">Same-day before {cutoff}</span>
                          <span className="text-body-sm text-ink-muted">otherwise {etaLabel({ sameDay: false, etaMinDays: z.etaMinDays, etaMaxDays: z.etaMaxDays }).toLowerCase()}</span>
                        </span>
                      ) : (
                        etaLabel({ sameDay: false, etaMinDays: z.etaMinDays, etaMaxDays: z.etaMaxDays })
                      )}
                    </td>
                    <td className="py-2 text-body-sm text-ink-muted">{hubName.get(z.hubCode) ?? z.hubCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <ProseSection id="pod" title="How Pay on Delivery works" icon="payments">
          <ol>
            <li>Place your order on the website — there is no payment step on the site.</li>
            <li>
              We open a chat with you on WhatsApp (or the app you picked). Ask for <strong>Pay on Delivery</strong> there.
            </li>
            <li>
              Our team confirms whether POD is available for your address and order. For some states or high-value orders we may ask
              for a small part payment first; we&apos;ll always tell you before dispatch.
            </li>
            <li>When the rider arrives, open the package, check the item, then pay by cash, transfer or POS.</li>
          </ol>
          <p className="flex items-start gap-1.5 rounded-lg bg-emerald-soft p-2.5 text-body-sm text-emerald-ink">
            <Icon name="lock" className="mt-0.5 shrink-0 text-sm" />
            MUBAZZAR staff and riders will never ask for your card PIN, OTP or BVN.
          </p>
        </ProseSection>

        <ProseSection id="tips" title="Tips for a smooth delivery" icon="task_alt">
          <ul>
            <li>Use an active WhatsApp number — riders call or message before arriving.</li>
            <li>Add a landmark or bus-stop (e.g. &ldquo;opposite Shoprite&rdquo;) so the rider finds you faster.</li>
            <li>
              If you&apos;ll be away, tell us in chat and we&apos;ll reschedule. You can check progress any time on{" "}
              <Link href="/track">Track My Order</Link>.
            </li>
          </ul>
        </ProseSection>

        <HelpCard settings={settings} message="Hello MUBAZZAR, I have a question about delivery." />
      </StaticBody>
    </>
  );
}
