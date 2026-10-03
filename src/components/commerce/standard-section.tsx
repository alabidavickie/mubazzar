import Image from "next/image";
import { Icon } from "@/components/icons/icon";

const PILLARS = [
  { icon: "speed", label: "Same-Day Dispatch" },
  { icon: "fact_check", label: "Strict Quality Vetting" },
  { icon: "lock", label: "No Card Details Online" },
  { icon: "support_agent", label: "WhatsApp Concierge" },
];

export const STRESS_TEST_STEPS = [
  { title: "Unbox & inspect", body: "Every batch is opened and checked against the supplier's spec sheet." },
  { title: "Power & function test", body: "We charge, switch on and run each gadget through its real use case." },
  { title: "Durability check", body: "Drop, heat and dust checks for Nigerian roads, harmattan and NEPA." },
  { title: "Repack & seal", body: "Approved units are resealed with a MUBAZZAR tested sticker before dispatch." },
];

/** "The MUBAZZAR Standard" trust block (design: Home). */
export function StandardSection({ detailed = false }: { detailed?: boolean }) {
  return (
    <section aria-labelledby="standard-title" className="bg-card px-4 py-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-container shadow-card">
          <Image src="/brand/emblem.webp" alt="" width={32} height={32} className="rounded" />
        </span>
        <div>
          <h2 id="standard-title" className="text-headline-sm font-bold text-navy">
            The MUBAZZAR Standard
          </h2>
          <p className="text-label-sm text-bronze">Tested. Vetted. Delivered.</p>
        </div>
      </div>
      <p className="mb-3 text-body-sm leading-relaxed text-ink-muted">
        We believe Nigerian shoppers deserve reliable quality without fear of disappointment. Every gadget in our catalogue goes
        through a 4-step stress test by our team before it is listed. No substandard knock-offs, no false claims — only tested,
        innovative lifestyle upgrades.
      </p>
      {detailed ? (
        <ol className="mb-3 grid gap-2 sm:grid-cols-2">
          {STRESS_TEST_STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-lg bg-surface-low p-3">
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
      ) : null}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PILLARS.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5 rounded-lg bg-surface-container p-2">
            <Icon name={p.icon} className="text-xl text-bronze" />
            <span className="text-label-sm text-ink">{p.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
