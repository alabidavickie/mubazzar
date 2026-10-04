import { NextResponse } from "next/server";
import { getPublicSettings } from "@/server/services/settings";
import { buildWhatsAppLink } from "@/lib/chat/links";

/**
 * Redirects to the support WhatsApp chat configured in settings. Lets client-only screens
 * (error boundaries) offer WhatsApp help without bundling or hard-coding the number.
 */
export async function GET() {
  let number = "";
  try {
    number = (await getPublicSettings()).support.whatsapp;
  } catch {
    return NextResponse.redirect(new URL("/faq", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"), 302);
  }
  const href = buildWhatsAppLink(number, "Hello MUBAZZAR, a page on your website didn't load. Can you help me with my order?");
  return NextResponse.redirect(href, 302);
}
