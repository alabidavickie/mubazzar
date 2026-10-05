import type { Metadata } from "next";
import { requireRole } from "@/server/session";
import { listAddresses } from "@/server/services/account";
import { getDeliveryZones } from "@/server/services/settings";
import { formatNgPhoneLocal } from "@/lib/phone";
import { AccountNav } from "@/components/account/account-nav";
import { AddressForm } from "@/components/account/account-forms";

export const metadata: Metadata = { title: "Saved addresses", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const session = await requireRole(["customer"], "/account/addresses");
  const [addresses, zones] = await Promise.all([listAddresses(session), getDeliveryZones()]);
  const states = zones.map((z) => ({ state: z.state, displayName: z.displayName }));
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <AccountNav current="/account/addresses" name={session.fullName?.split(" ")[0] ?? "there"} />
      <p className="text-body-md text-ink-muted">Your default address fills the order form for you.</p>
      {addresses.map((a) => (
        <AddressForm key={a.id} states={states} initial={{ id: a.id, label: a.label, fullName: a.fullName, phone: formatNgPhoneLocal(a.phoneE164), state: a.state, city: a.city, address: a.address, landmark: a.landmark ?? "", isDefault: a.isDefault }} />
      ))}
      <h2 className="text-label-lg font-bold text-navy">Add an address</h2>
      <AddressForm states={states} initial={{ id: null, label: "Home", fullName: session.fullName ?? "", phone: session.phone ? formatNgPhoneLocal(session.phone) : "", state: "", city: "", address: "", landmark: "", isDefault: addresses.length === 0 }} />
    </div>
  );
}
