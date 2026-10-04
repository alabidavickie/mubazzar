import type { Metadata } from "next";
import Link from "next/link";
import { HelpCard, OnThisPage, ProseSection, StaticBody, StaticHero } from "@/components/storefront/static-page";
import { getPublicSettings } from "@/server/services/settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How MUBAZZAR collects, uses and protects your personal data under the Nigeria Data Protection Act 2023. We never collect card details.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const settings = await getPublicSettings();
  const { business, support } = settings;
  return (
    <>
      <StaticHero
        eyebrow="Policy"
        icon="policy"
        title="Privacy Policy"
        updated="4 October 2026"
        intro={
          <p>
            This policy explains what personal data {business.legalName} (&ldquo;MUBAZZAR&rdquo;, &ldquo;we&rdquo;) collects, why, and
            your rights under the Nigeria Data Protection Act 2023 (NDPA).
          </p>
        }
      />
      <StaticBody>
        <OnThisPage
          links={[
            { href: "#collect", label: "What we collect" },
            { href: "#use", label: "How we use it" },
            { href: "#share", label: "Who we share with" },
            { href: "#rights", label: "Your rights" },
            { href: "#contact", label: "Contact" },
          ]}
        />

        <ProseSection id="collect" title="What we collect" icon="fact_check">
          <ul>
            <li>
              <strong>Order details</strong> — your name, WhatsApp number, optional alternative phone, state, LGA/city, address,
              landmark, chosen chat app and the items you order.
            </li>
            <li>
              <strong>Account details</strong> (only if you sign in) — phone number or email, saved addresses and order history.
            </li>
            <li>
              <strong>Technical data</strong> — pages visited, ad campaign tags (UTM, fbclid) and a one-way hash of your IP address
              used to stop spam and abuse.
            </li>
          </ul>
          <p>
            <strong>We never collect card numbers, PINs, OTPs, BVNs or bank login details on this website.</strong> Payments are
            arranged in chat with our staff, who only record that a payment was received.
          </p>
        </ProseSection>

        <ProseSection id="use" title="How we use your data (and our lawful basis)" icon="task_alt">
          <ul>
            <li>To process, confirm and deliver your order, and contact you about it — <em>performance of a contract</em>.</li>
            <li>To prevent fraud, fake orders and abuse (e.g. rate limits, duplicate-order checks) — <em>legitimate interest</em>.</li>
            <li>To keep records required for tax and accounting — <em>legal obligation</em>.</li>
            <li>
              To measure which adverts bring customers (Meta Pixel and Conversions API, where enabled) — <em>consent / legitimate
              interest</em>. You can block these with your browser or ad settings.
            </li>
          </ul>
          <p>We do not sell your personal data.</p>
        </ProseSection>

        <ProseSection id="share" title="Who we share it with" icon="group">
          <ul>
            <li>Dispatch riders and delivery partners — only the details needed to deliver your order.</li>
            <li>Hosting and database providers that store our data securely on our behalf.</li>
            <li>Messaging providers (WhatsApp, SMS and email) used to send your order updates.</li>
            <li>Meta (Facebook/Instagram), when ad measurement is enabled — hashed contact details only.</li>
            <li>Authorities, when the law requires it.</li>
          </ul>
          <p>
            Some providers process data outside Nigeria. Where that happens we rely on the safeguards allowed under the NDPA and
            only use providers with strong security commitments.
          </p>
        </ProseSection>

        <ProseSection title="How long we keep it" icon="history">
          <p>
            Order records are kept for up to 6 years for accounting and warranty purposes. Unconfirmed orders that were cancelled are
            deleted or anonymised sooner. Abuse-prevention data (hashed IPs) is kept for a few days.
          </p>
        </ProseSection>

        <ProseSection title="Security" icon="lock">
          <p>
            Data is encrypted in transit (HTTPS), access is limited by staff role, and every payment record is audit-logged. No
            system is perfect: if a breach affects you, we will notify you and the Nigeria Data Protection Commission as the NDPA
            requires.
          </p>
        </ProseSection>

        <ProseSection id="rights" title="Your rights under the NDPA" icon="gavel">
          <p>You can ask us to:</p>
          <ul>
            <li>give you a copy of your data, or send it to another provider;</li>
            <li>correct data that is wrong or incomplete;</li>
            <li>delete your data where we no longer need it;</li>
            <li>restrict or object to some processing, including marketing;</li>
            <li>withdraw consent at any time (this doesn&apos;t affect earlier processing).</li>
          </ul>
          <p>
            We respond within 30 days. If you are unhappy with our answer you can complain to the Nigeria Data Protection Commission
            (NDPC).
          </p>
        </ProseSection>

        <ProseSection id="contact" title="Contact us" icon="mail">
          <p>
            {business.legalName}, {business.address}. Email <a href={`mailto:${support.email}`}>{support.email}</a> with the
            subject &ldquo;Data request&rdquo;, or chat with us on WhatsApp. See also our <Link href="/terms">Terms of Service</Link>.
          </p>
        </ProseSection>

        <HelpCard settings={settings} message="Hello MUBAZZAR, I have a data/privacy request." />
      </StaticBody>
    </>
  );
}
