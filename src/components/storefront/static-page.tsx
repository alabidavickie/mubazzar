import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { buildWhatsAppLink } from "@/lib/chat/links";
import { formatNgPhoneIntl } from "@/lib/phone";
import { cn } from "@/lib/cn";
import type { PublicSettings } from "@/server/services/settings";

/** Navy hero used by information pages (same language as the Home hero). */
export function StaticHero({
  eyebrow,
  title,
  intro,
  icon,
  updated,
}: {
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  icon: string;
  updated?: string;
}) {
  return (
    <div className="px-4 pt-3">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-navy-deep via-navy to-navy-deep p-5 text-on-dark shadow-raised">
        <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-10 size-44 rounded-full bg-gold-soft/10 blur-2xl" />
        <span className="relative inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-label-sm font-extrabold tracking-wider text-bronze-ink uppercase">
          <Icon name={icon} className="text-xs" /> {eyebrow}
        </span>
        <h1 className="relative mt-2 font-display text-headline-xl font-bold">{title}</h1>
        {intro ? <div className="relative mt-1 text-body-md text-on-dark-muted">{intro}</div> : null}
        {updated ? <p className="relative mt-2 text-label-sm text-gold-pale">Last updated: {updated}</p> : null}
      </div>
    </div>
  );
}

export function StaticBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4", className)}>{children}</div>;
}

/** Content card with an h2; children are paragraphs/lists styled for reading. */
export function ProseSection({
  title,
  icon,
  id,
  children,
}: {
  title: string;
  icon?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-32 rounded-xl bg-card p-4 shadow-card">
      <h2 id={id ? `${id}-title` : undefined} className="mb-2 flex items-center gap-2 text-headline-sm font-bold text-navy">
        {icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-container text-bronze">
            <Icon name={icon} className="text-lg" />
          </span>
        ) : null}
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-body-md leading-relaxed text-ink-muted [&_a]:font-semibold [&_a]:text-navy [&_a]:underline [&_a]:underline-offset-2 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

/** "Still need help?" card with WhatsApp, phone and email from settings. */
export function HelpCard({ settings, message = "Hello MUBAZZAR, I have a question." }: { settings: PublicSettings; message?: string }) {
  const { support } = settings;
  return (
    <section aria-labelledby="help-title" className="flex flex-col gap-3 rounded-xl bg-surface-low p-4 shadow-card">
      <div>
        <h2 id="help-title" className="text-headline-sm font-bold text-navy">
          Still need help?
        </h2>
        <p className="text-body-sm text-ink-muted">Real people on our Nigerian support desk · {support.hours}</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <a
          href={buildWhatsAppLink(support.whatsapp, message)}
          target="_blank"
          rel="noopener"
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-ink px-4 text-label-md text-on-dark shadow-card"
        >
          <WhatsAppIcon /> Chat on WhatsApp
        </a>
        <a href={`tel:${support.phone}`} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-card px-4 text-label-md text-navy shadow-card">
          <Icon name="call" className="text-base" /> {formatNgPhoneIntl(support.phone)}
        </a>
        <a href={`mailto:${support.email}`} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-card px-4 text-label-md text-navy shadow-card">
          <Icon name="mail" className="text-base" /> Email us
        </a>
      </div>
    </section>
  );
}

/** Small in-page link list ("On this page"). */
export function OnThisPage({ links }: { links: { href: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="rounded-xl bg-card p-3 shadow-card">
      <p className="mb-1 text-label-sm tracking-wider text-bronze uppercase">On this page</p>
      <ul className="flex flex-wrap gap-x-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="inline-flex min-h-11 items-center text-label-md text-navy underline-offset-2 hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
