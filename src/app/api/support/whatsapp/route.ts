import { NextResponse } from "next/server";
import { getPublicSettings } from "@/server/services/settings";
import { buildWhatsAppLink } from "@/lib/chat/links";
import { siteUrl } from "@/lib/site";

/**
 * Redirects to the support WhatsApp chat configured in settings. Lets client-only screens
 * (error boundaries) offer WhatsApp help without bundling or hard-coding the number.
 */
export async function GET() {
  let number = "";
  try {
    number = (await getPublicSettings()).support.whatsapp;
  } catch {
    return NextResponse.redirect(new URL("/faq", siteUrl()), 302);
  }
  const href = buildWhatsAppLink(number, "Hello MUBAZZAR, a page on your website didn't load. Can you help me with my order?");
  return NextResponse.redirect(href, 302);
}
