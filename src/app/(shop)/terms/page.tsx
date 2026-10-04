import type { Metadata } from "next";
import Link from "next/link";
import { HelpCard, ProseSection, StaticBody, StaticHero } from "@/components/storefront/static-page";
import { getPublicSettings } from "@/server/services/settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for ordering from MUBAZZAR: orders, pricing, payment in chat, delivery, returns and liability.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const settings = await getPublicSettings();
  const { business } = settings;
  return (
    <>
      <StaticHero
        eyebrow="Policy"
        icon="gavel"
        title="Terms of Service"
        updated="4 October 2026"
        intro={
          <p>
            These terms apply when you browse or order from MUBAZZAR, operated by {business.legalName}. By placing an order you agree
            to them.
          </p>
        }
      />
      <StaticBody>
        <ProseSection title="1. Orders" icon="shopping_bag">
          <p>
            Placing an order on the website is a request to buy. A contract is formed only when our team confirms the order with
            you in chat. We may decline or cancel an order — for example if an item is out of stock, a price was shown in error, or
            we suspect fraud — and we will tell you why.
          </p>
          <p>Unpaid orders that are not confirmed in chat may be cancelled automatically after a period so stock is released.</p>
        </ProseSection>

        <ProseSection title="2. Prices" icon="sell">
          <p>
            Prices are in Nigerian Naira (₦) and include applicable taxes. The delivery fee for your state is shown before you place
            your order. Flash-deal prices apply until the end time shown on the page. Our system recalculates every price at order
            time, and the confirmed price in chat is final.
          </p>
        </ProseSection>

        <ProseSection title="3. Payment" icon="payments">
          <p>
            We do not take payment on this website. Our staff share official payment details in chat; pay only into accounts in our
            registered business name. Pay on Delivery may be offered for eligible orders and addresses. We will never ask for your
            card PIN, OTP or BVN.
          </p>
        </ProseSection>

        <ProseSection title="4. Delivery" icon="local_shipping">
          <p>
            Delivery times are estimates in working days from confirmation. Same-day delivery applies only to the cities and cut-off
            time shown on our <Link href="/delivery">Delivery page</Link>. Risk passes to you when the item is handed over at your
            address.
          </p>
        </ProseSection>

        <ProseSection title="5. Returns, warranty and refunds" icon="currency_exchange">
          <p>
            Faulty, wrong or damaged items can be returned within {business.returnsDays} days of delivery as set out in our{" "}
            <Link href="/returns">Returns & Refund Policy</Link>. Nothing in these terms limits your rights under the Federal
            Competition and Consumer Protection Act 2018.
          </p>
        </ProseSection>

        <ProseSection title="6. Reviews and content" icon="rate_review">
          <p>
            Reviews must be honest and about your own experience. We may remove reviews that are abusive, off-topic or fake. Reviews
            labelled &ldquo;Sample review&rdquo; are demo content and not from real customers.
          </p>
        </ProseSection>

        <ProseSection title="7. Liability" icon="shield">
          <p>
            To the extent the law allows, our liability for any order is limited to the amount you paid for it. We are not liable for
            losses caused by misuse of a product or events outside our reasonable control (such as strikes, flooding or network
            outages).
          </p>
        </ProseSection>

        <ProseSection title="8. Governing law and contact" icon="mail">
          <p>
            These terms are governed by the laws of the Federal Republic of Nigeria. {business.legalName}, {business.address}
            {business.cac ? ` (CAC: ${business.cac})` : ""}. Questions? Contact us using the options below. Read how we handle your
            data in our <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </ProseSection>

        <HelpCard settings={settings} />
      </StaticBody>
    </>
  );
}
