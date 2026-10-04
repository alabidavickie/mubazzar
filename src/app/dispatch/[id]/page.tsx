import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/session";
import { getMyDelivery } from "@/server/services/dispatch";
import { formatNaira } from "@/lib/money";
import { formatNgPhoneLocal } from "@/lib/phone";
import { Icon } from "@/components/icons/icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { DeliveryForms } from "@/components/dispatch/delivery-forms";

export const metadata = { title: "Delivery" };

type Params = Promise<{ id: string }>;

export default async function DeliveryPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await requireRole(["dispatcher"], `/dispatch/${id}`);
  const d = await getMyDelivery(session, id);
  if (!d) notFound();
  const open = d.assignmentStatus === "assigned" && d.status === "dispatched";
  return (
    <div className="flex flex-col gap-4">
      <Link href="/dispatch" className="inline-flex min-h-11 w-fit items-center gap-1 text-label-lg text-navy">
        <Icon name="arrow_back" /> My deliveries
      </Link>
      <div>
        <h1 className="text-headline-md font-bold text-navy tabular">{d.orderNumber}</h1>
        <p className="text-body-lg font-semibold">{d.customerName}</p>
        <p className="text-body-md text-ink-muted">{formatNgPhoneLocal(d.phoneE164)}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <a href={d.callUrl} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-navy text-label-md font-bold text-on-dark">
          <Icon name="call" className="text-2xl" /> Call
        </a>
        <a
          href={d.whatsappUrl}
          target="_blank"
          rel="noopener"
          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-emerald-ink text-label-md font-bold text-on-dark"
        >
          <WhatsAppIcon className="text-2xl" /> WhatsApp
        </a>
        <a
          href={d.mapsUrl}
          target="_blank"
          rel="noopener"
          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-surface-high text-label-md font-bold text-navy"
          data-testid="maps-link"
        >
          <Icon name="map" className="text-2xl" /> Map
        </a>
      </div>

      <section className="rounded-xl bg-card p-4 shadow-card" aria-label="Address">
        <p className="text-label-sm text-ink-muted uppercase">Address</p>
        <p className="text-body-lg">
          {d.address}, {d.city}, {d.state}
        </p>
        {d.landmark ? <p className="text-body-md text-ink-muted">Landmark: {d.landmark}</p> : null}
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card" aria-label="Package">
        <p className="text-label-sm text-ink-muted uppercase">Package</p>
        <ul className="text-body-md">
          {d.lines.map((l, i) => (
            <li key={i}>
              {l.units}× {l.isFreeGift ? `${l.name} (free gift)` : l.name}
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-baseline justify-between text-body-lg">
          <span className="font-semibold">To collect</span>
          <span className="text-headline-sm font-extrabold text-navy-deep tabular" data-testid="to-collect">
            {formatNaira(d.balanceKobo)}
          </span>
        </p>
        {d.balanceKobo === 0 ? <p className="text-body-sm text-emerald-ink">Already paid in full — do not collect money.</p> : null}
        {d.podAgreed && d.balanceKobo > 0 ? <p className="text-body-sm text-bronze">Pay on delivery was agreed with the customer.</p> : null}
      </section>

      {open ? (
        <DeliveryForms orderId={d.id} balanceKobo={d.balanceKobo} />
      ) : d.assignmentStatus === "delivered" ? (
        <p role="status" className="rounded-xl bg-emerald-soft p-4 text-label-lg text-emerald-ink" data-testid="delivery-done">
          Marked delivered. Thank you!
        </p>
      ) : d.assignmentStatus === "failed" ? (
        <p role="status" className="rounded-xl bg-urgent-soft p-4 text-label-lg text-urgent-ink" data-testid="delivery-done">
          Marked as failed. The office has been updated.
        </p>
      ) : (
        <p className="rounded-lg bg-surface-high px-3 py-2 text-label-md text-navy">This delivery was reassigned or closed by the office.</p>
      )}
    </div>
  );
}
