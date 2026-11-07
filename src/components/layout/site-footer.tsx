import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { formatNgPhoneIntl } from "@/lib/phone";
import { buildWhatsAppLink } from "@/lib/chat/links";
import type { PublicSettings } from "@/server/services/settings";

/** Navy footer — brand, support desk and helpline, policies, compliance details. */
export function SiteFooter({ settings }: { settings: PublicSettings }) {
  const { support, business } = settings;
  const year = new Date().getFullYear();
  return (
    <footer className="mt-4 bg-navy-deep text-on-dark">
      <div className="mx-auto flex max-w-(--container-site) flex-col gap-8 px-4 pt-8 pb-40 lg:pb-10">
        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div className="flex flex-col gap-2">
            <Link href="/" className="flex w-fit items-center gap-2 font-display text-headline-md font-bold tracking-wide text-on-dark">
              <Image src="/brand/emblem.webp" alt="" width={36} height={36} className="rounded-lg" />
              MUBAZZAR
            </Link>
            <p className="max-w-md text-body-md text-on-dark-muted">
              Uncommon gadgets and viral problem solvers, tested by our team before they leave the hub.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch md:justify-end">
            <a
              href={buildWhatsAppLink(support.whatsapp, "Hello MUBAZZAR, I need help ordering.")}
              target="_blank"
              rel="noopener"
              className="flex min-h-14 items-center gap-3 rounded-xl bg-emerald-ink px-4 py-2 text-on-dark transition-colors hover:bg-emerald-deep"
            >
              <Icon name="chat" className="shrink-0 text-2xl" />
              <span>
                <span className="block text-label-lg">Need Help Ordering?</span>
                <span className="block text-body-sm text-emerald-soft">Chat with our Nigerian support desk on WhatsApp</span>
              </span>
            </a>
            <div className="flex flex-col justify-center rounded-xl border border-on-dark/15 px-4 py-2">
              <span className="text-label-sm text-on-dark-muted">Official helpline · {support.hours}</span>
              <a href={`tel:${support.phone}`} className="text-headline-sm font-bold text-gold-pale tabular hover:underline">
                {formatNgPhoneIntl(support.phone)}
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 border-t border-on-dark/10 pt-6 md:grid-cols-3">
          <nav aria-label="Help and policies" className="flex flex-col gap-1">
            <p className="mb-1 text-label-md text-gold-pale">Help & Policies</p>
            <FooterLink href="/track">Track My Order</FooterLink>
            <FooterLink href="/delivery">Delivery & Pay on Delivery</FooterLink>
            <FooterLink href="/returns">{business.returnsDays}-Day Return Policy</FooterLink>
            <FooterLink href="/faq">Frequently Asked Questions</FooterLink>
            <FooterLink href="/privacy">Privacy Policy</FooterLink>
            <FooterLink href="/terms">Terms of Service</FooterLink>
          </nav>
          <nav aria-label="Company" className="flex flex-col gap-1">
            <p className="mb-1 text-label-md text-gold-pale">MUBAZZAR</p>
            <FooterLink href="/about">The MUBAZZAR Standard</FooterLink>
            <FooterLink href="/shop">Shop All Gadgets</FooterLink>
            <FooterLink href="/deals">Flash Deals</FooterLink>
            <FooterLink href="/login">Sign In</FooterLink>
          </nav>
          <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
            <p className="mb-1 text-label-md text-gold-pale">Business details</p>
            <p className="text-body-sm text-on-dark-muted">{business.legalName}</p>
            <p className="text-body-sm text-on-dark-muted">{business.address}</p>
            {business.cac ? <p className="text-body-sm text-on-dark-muted">CAC: {business.cac}</p> : null}
            <a href={`mailto:${support.email}`} className="w-fit text-body-sm text-on-dark-muted underline-offset-2 hover:text-on-dark hover:underline">
              {support.email}
            </a>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 border-t border-on-dark/10 pt-5 md:flex-row md:justify-between">
          <p className="text-center text-body-sm text-on-dark-muted">
            © {year} {business.legalName} All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-on-dark-muted">
            <span className="flex items-center gap-1 text-label-sm">
              <Icon name="shield" className="text-sm" /> No card details collected on this site
            </span>
            <span className="flex items-center gap-1 text-label-sm">
              <Icon name="local_shipping" className="text-sm" /> Nationwide Dispatch
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="w-fit py-1 text-body-sm text-on-dark-muted hover:text-on-dark hover:underline">
      {children}
    </Link>
  );
}
