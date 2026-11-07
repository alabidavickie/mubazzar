import { Icon } from "@/components/icons/icon";
import { TestedSeal } from "./seal";

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

/** "The MUBAZZAR Standard": the tested-seal promise and the real 4-step stress test. */
export function StandardSection({ detailed = false }: { detailed?: boolean }) {
  return (
    <section aria-labelledby="standard-title" className="px-4 pt-8 pb-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid gap-5 p-5 md:grid-cols-[auto_1fr] md:items-center md:gap-8 md:p-8">
          <TestedSeal className="size-24 md:size-32" />
          <div>
            <h2 id="standard-title" className="font-display text-headline-md leading-tight font-bold tracking-tight text-navy-deep md:text-headline-xl">
              The MUBAZZAR Standard
            </h2>
            <p className="mt-0.5 text-label-md text-bronze">Tested. Vetted. Delivered.</p>
            <p className="mt-2 max-w-2xl text-body-md text-ink-muted">
              We believe Nigerian shoppers deserve reliable quality without fear of disappointment. Every gadget in our catalogue goes
              through a 4-step stress test by our team before it is listed. No substandard knock-offs, no false claims — only tested,
              innovative lifestyle upgrades.
            </p>
          </div>
        </div>

        {detailed ? (
          <ol className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {STRESS_TEST_STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 border-line p-4 not-last:border-b sm:not-last:border-b-0 sm:[&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0 lg:not-last:border-r md:p-5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-deep font-display text-label-lg text-gold-soft tabular">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-label-lg text-navy-deep">{s.title}</span>
                  <span className="mt-0.5 block text-body-sm text-ink-muted">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <ul className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          {PILLARS.map((p) => (
            <li key={p.label} className="flex items-center gap-2 bg-surface-low px-4 py-3">
              <Icon name={p.icon} className="shrink-0 text-xl text-bronze" />
              <span className="text-label-sm text-ink">{p.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
