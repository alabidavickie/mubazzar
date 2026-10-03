import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { formatNgPhoneIntl } from "@/lib/phone";
import { buildWhatsAppLink } from "@/lib/chat/links";
import type { PublicSettings } from "@/server/services/settings";

/** Navy footer (design: Home) — support desk, helpline, policies, compliance details. */
export function SiteFooter({ settings }: { settings: PublicSettings }) {
  const { support, business } = settings;
  const year = new Date().getFullYear();
  return (
    <footer className="bg-navy-deep text-on-dark">
      <div className="mx-auto flex max-w-(--container-site) flex-col gap-4 px-4 pt-5 pb-28 lg:pb-10">
        <a
          href={buildWhatsAppLink(support.whatsapp, "Hello MUBAZZAR, I need help ordering.")}
          target="_blank"
          rel="noopener"
          className="flex items-center justify-between rounded-xl bg-emerald-deep p-3 text-emerald-mint shadow-card"
        >
          <span className="flex items-center gap-2">
            <Icon name="chat" className="text-2xl text-emerald" />
            <span>
              <span className="block text-label-md font-bold text-on-dark">Need Help Ordering?</span>
              <span className="block text-label-sm text-on-dark-muted">Chat with our Nigerian support desk on WhatsApp</span>
            </span>
          </span>
          <Icon name="arrow_forward" className="text-emerald" />
        </a>

        <div className="flex items-center justify-between gap-4 py-1">
          <div>
            <p className="text-label-sm text-on-dark-muted uppercase">Official Helpline</p>
            <a href={`tel:${support.phone}`} className="text-headline-sm font-bold text-gold-pale">
              {formatNgPhoneIntl(support.phone)}
            </a>
          </div>
          <div className="text-right">
            <p className="text-label-sm text-on-dark-muted uppercase">Operating Hours</p>
            <p className="text-body-sm">{support.hours}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 md:grid-cols-3">
          <nav aria-label="Help and policies" className="flex flex-col gap-1">
            <p className="mb-0.5 text-label-md font-bold text-gold-pale">Help & Policies</p>
            <FooterLink href="/track">Track My Order</FooterLink>
            <FooterLink href="/delivery">Delivery & Pay on Delivery</FooterLink>
            <FooterLink href="/returns">{business.returnsDays}-Day Return Policy</FooterLink>
            <FooterLink href="/faq">Frequently Asked Questions</FooterLink>
            <FooterLink href="/privacy">Privacy Policy</FooterLink>
            <FooterLink href="/terms">Terms of Service</FooterLink>
          </nav>
          <nav aria-label="Company" className="flex flex-col gap-1">
            <p className="mb-0.5 text-label-md font-bold text-gold-pale">MUBAZZAR</p>
            <FooterLink href="/about">The MUBAZZAR Standard</FooterLink>
            <FooterLink href="/shop">Shop All Gadgets</FooterLink>
            <FooterLink href="/deals">Flash Deals</FooterLink>
            <FooterLink href="/sell">Become a Supplier</FooterLink>
            <FooterLink href="/login">Sign In</FooterLink>
          </nav>
          <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
            <p className="mb-0.5 text-label-md font-bold text-gold-pale">Business details</p>
            <p className="text-body-sm text-on-dark-muted">{business.legalName}</p>
            <p className="text-body-sm text-on-dark-muted">{business.address}</p>
            {business.cac ? <p className="text-body-sm text-on-dark-muted">CAC: {business.cac}</p> : null}
            <a href={`mailto:${support.email}`} className="text-body-sm text-on-dark-muted underline-offset-2 hover:underline">
              {support.email}
            </a>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 pt-3">
          <div className="flex flex-wrap items-center justify-center gap-4 text-on-dark-muted">
            <span className="flex items-center gap-1 text-label-sm">
              <Icon name="shield" className="text-sm" /> No card details collected on this site
            </span>
            <span className="flex items-center gap-1 text-label-sm">
              <Icon name="local_shipping" className="text-sm" /> Nationwide Dispatch
            </span>
          </div>
          <p className="text-center text-body-sm text-on-dark-muted">
            © {year} {business.legalName} All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="py-1 text-body-sm text-on-dark-muted hover:text-on-dark">
      {children}
    </Link>
  );
}
