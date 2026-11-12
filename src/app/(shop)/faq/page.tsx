import type { Metadata } from "next";
import { Accordion } from "@/components/ui/misc";
import { HelpCard, OnThisPage, StaticBody, StaticHero } from "@/components/storefront/static-page";
import { getPublicSettings } from "@/server/services/settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "How ordering, WhatsApp confirmation, Pay on Delivery and delivery work at MUBAZZAR.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const settings = await getPublicSettings();

  const groups: { id: string; title: string; items: { question: string; answer: string }[] }[] = [
    {
      id: "ordering",
      title: "Ordering",
      items: [
        {
          question: "Do I need an account to order?",
          answer:
            "No. Fill in your name, WhatsApp number and delivery address, then place the order. You can create an account later to see your order history.",
        },
        {
          question: "What happens after I place an order?",
          answer:
            "You get an order number (like MBZ-7K2QPA) and we open a chat with you on WhatsApp — or the app you chose. Our team confirms the items, delivery fee and address. You pay when your order is delivered.",
        },
        {
          question: "Can I change or cancel my order?",
          answer:
            "Yes, until it is dispatched. Message us in the same chat with your order number. Unpaid orders that are never confirmed in chat are cancelled automatically after a while so the stock goes back to other shoppers.",
        },
        {
          question: "How do I track my order?",
          answer: "Use the Track Order page with your order number and the phone number you ordered with.",
        },
      ],
    },
    {
      id: "payment",
      title: "Payment & Pay on Delivery",
      items: [
        {
          question: "Why is there no card payment on the website?",
          answer:
            "To protect you. We never collect card numbers, PINs or OTPs online. You pay when your order is delivered, and our staff record your payment against your order number.",
        },
        {
          question: "Is Pay on Delivery available?",
          answer:
            "Yes. Every order is Pay on Delivery. We confirm your order and delivery in chat first, and you pay when it arrives.",
        },
        {
          question: "How do I know I'm paying the real MUBAZZAR?",
          answer:
            "You only pay when your order is delivered to you. Our official WhatsApp number is the one shown on this website. MUBAZZAR staff will never ask for your card PIN, OTP or BVN.",
        },
      ],
    },
    {
      id: "delivery",
      title: "Delivery",
      items: [
        {
          question: "How much is delivery, and how long does it take?",
          answer: "Both depend on your address. We tell you the delivery fee and the delivery time on WhatsApp when we confirm your order, before you pay.",
        },
        {
          question: "Do you deliver to every state?",
          answer: "We deliver across Nigeria. Tell us your address in the chat and we will confirm.",
        },
        {
          question: "Can I check the item before paying the rider?",
          answer:
            "If you arranged Pay on Delivery, you can open the outer package and switch the item on in front of the rider before paying.",
        },
      ],
    },
    {
      id: "problems",
      title: "If something is wrong",
      items: [
        {
          question: "What if my item arrives faulty or is the wrong one?",
          answer: "Message us on WhatsApp with your order number and a short video or photo, and we will sort it out with you.",
        },
      ],
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((g) =>
      g.items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })),
    ),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <StaticHero
        eyebrow="Help centre"
        icon="help"
        title="Frequently Asked Questions"
        intro={<p>Quick answers about ordering, paying in chat and delivery.</p>}
      />
      <StaticBody>
        <OnThisPage links={groups.map((g) => ({ href: `#${g.id}`, label: g.title }))} />
        {groups.map((g) => (
          <section key={g.id} id={g.id} aria-labelledby={`${g.id}-title`} className="flex scroll-mt-32 flex-col gap-2">
            <h2 id={`${g.id}-title`} className="text-headline-sm font-bold text-navy">
              {g.title}
            </h2>
            <Accordion items={g.items} />
          </section>
        ))}
        <HelpCard settings={settings} />
      </StaticBody>
    </>
  );
}
