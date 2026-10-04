import type { Metadata } from "next";
import { Accordion } from "@/components/ui/misc";
import { HelpCard, OnThisPage, StaticBody, StaticHero } from "@/components/storefront/static-page";
import { getPublicSettings } from "@/server/services/settings";
import { formatCutoff } from "@/lib/time";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "How ordering, payment in WhatsApp chat, Pay on Delivery, delivery times, returns and warranties work at MUBAZZAR.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const settings = await getPublicSettings();
  const cutoff = formatCutoff(settings.sameDayCutoff);
  const days = settings.business.returnsDays;

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
            "You get an order number (like MBZ-7K2QPA) and we open a chat with you on WhatsApp — or the app you chose. Our team confirms the items, delivery fee and address, then shares payment details.",
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
            "To protect you. We never collect card numbers, PINs or OTPs online. Our staff share MUBAZZAR's official payment details in chat, and record your payment against your order number.",
        },
        {
          question: "Is Pay on Delivery available?",
          answer:
            "Pay on Delivery can be arranged in chat for most addresses, especially in Lagos and Abuja. For some states or high-value orders we may ask for a part payment first — our team will tell you before anything is dispatched.",
        },
        {
          question: "How do I know I'm paying the real MUBAZZAR?",
          answer:
            "Only pay to an account name that matches our registered business name, shared by our official WhatsApp numbers. MUBAZZAR staff will never ask for your card PIN, OTP or BVN.",
        },
      ],
    },
    {
      id: "delivery",
      title: "Delivery",
      items: [
        {
          question: "How fast is delivery?",
          answer: `Lagos and Abuja orders confirmed before ${cutoff} can be delivered the same day. Other states usually take 2–5 working days. The exact fee and time for your state show in the order form.`,
        },
        {
          question: "Do you deliver to every state?",
          answer: "Yes — all 36 states and the FCT, through our hubs and partner dispatch riders. See the Delivery page for fees by state.",
        },
        {
          question: "Can I check the item before paying the rider?",
          answer:
            "If you arranged Pay on Delivery, you can open the outer package and switch the item on in front of the rider before paying.",
        },
      ],
    },
    {
      id: "returns",
      title: "Returns & warranty",
      items: [
        {
          question: "What if my item arrives faulty?",
          answer: `Tell us within ${days} days of delivery with a short video of the fault. We'll swap it or refund you after inspection — see our Returns & Refund Policy.`,
        },
        {
          question: "Do products have a warranty?",
          answer:
            "Some products carry a warranty from 6 to 12 months; it's shown on the product page. Every item is tested by our team before dispatch.",
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
        intro={<p>Quick answers about ordering, paying in chat, delivery and returns.</p>}
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
