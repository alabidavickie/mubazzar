import type { Metadata } from "next";
import { TrackOrderForm } from "./track-form";

export const metadata: Metadata = {
  title: "Track My Order",
  description: "Check your MUBAZZAR order status with your order number and phone number, and continue your chat on WhatsApp.",
  alternates: { canonical: "/track" },
};

export default function TrackPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-4">
      <div>
        <h1 className="font-display text-headline-xl font-bold text-navy">Track My Order</h1>
        <p className="text-body-md text-ink-muted">
          Enter the order number from your confirmation (e.g. MBZ-7K2QPA) and the phone number you ordered with.
        </p>
      </div>
      <TrackOrderForm />
    </div>
  );
}
