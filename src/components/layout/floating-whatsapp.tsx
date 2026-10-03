"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { buildWhatsAppLink } from "@/lib/chat/links";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { track } from "@/lib/client/pixel";

/**
 * Floating WhatsApp button on every customer page. The prefilled message mentions the page the
 * shopper is on (product name from the document title) so staff know what they're asking about.
 */
export function FloatingWhatsApp({ number, className }: { number: string; className?: string }) {
  const pathname = usePathname();
  const [title, setTitle] = useState("");
  useEffect(() => {
    // Read after navigation so the new page's <title> is in place.
    const t = setTimeout(() => setTitle(document.title.replace(/\s*\|\s*MUBAZZAR\s*$/, "")), 50);
    return () => clearTimeout(t);
  }, [pathname]);

  const where = pathname.startsWith("/p/") || pathname.startsWith("/lp/") ? `the ${title}` : title || "your website";
  const message = `Hello MUBAZZAR 👋 I'm on ${where} (${pathname}) and I have a question.`;
  const href = buildWhatsAppLink(number, message);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label="Chat with MUBAZZAR on WhatsApp"
      data-testid="floating-whatsapp"
      onClick={() => track("Contact", { channel: "whatsapp", placement: "floating" })}
      className={cn(
        "fixed right-4 bottom-20 z-40 flex size-14 items-center justify-center rounded-full bg-emerald-ink text-on-dark shadow-float transition-transform hover:scale-105 active:scale-95 lg:bottom-6",
        className,
      )}
    >
      <WhatsAppIcon className="text-[1.75rem]" />
    </a>
  );
}
