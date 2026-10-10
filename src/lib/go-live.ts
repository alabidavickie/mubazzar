/**
 * "Before you go live" rules for the admin dashboard: what is still demo/test configuration that would
 * embarrass the business or lose orders once real customers arrive. Pure so it can be unit-tested; the
 * service reads the real settings and passes them in.
 */

/** Demo WhatsApp numbers shipped in the seed (`src/server/db/seed/reference.ts`). */
export const PLACEHOLDER_PHONES = ["+2348120008899", "+2348120008900"] as const;

export interface GoLiveInput {
  supportWhatsapp: string;
  enabledChannelHandles: string[];
  bankAccounts: { accountNumber: string }[];
  adminAlerts: { emails: string[]; phones: string[] };
  showSampleReviews: boolean;
  cac: string | null;
  siteUrl: string;
  services: { supabaseAuth: boolean; sms: boolean; email: boolean; metaCapi: boolean };
}

export interface GoLiveItem {
  key: string;
  /** blocker = customers would be hurt or misled; recommended = works, but not at full strength. */
  severity: "blocker" | "recommended";
  title: string;
  detail: string;
  /** Where to fix it in the admin; null = a Vercel environment variable (README §2). */
  href: string | null;
}

const digits = (s: string) => s.replace(/\D/g, "");
const isPlaceholderPhone = (p: string) => PLACEHOLDER_PHONES.some((x) => digits(x) === digits(p));

export function goLiveChecks(i: GoLiveInput): GoLiveItem[] {
  const out: GoLiveItem[] = [];
  const add = (item: GoLiveItem) => out.push(item);

  if (isPlaceholderPhone(i.supportWhatsapp)) {
    add({ key: "support-whatsapp", severity: "blocker", title: "Support WhatsApp number is still the demo number", detail: "It is shown in the header, footer and error pages — customers would message a number that isn't yours.", href: "/admin/homepage" });
  }
  if (i.enabledChannelHandles.some(isPlaceholderPhone)) {
    add({ key: "chat-channels", severity: "blocker", title: "Order chat channels use the demo WhatsApp number", detail: "Every order's \"Complete payment on WhatsApp\" button would open a chat with a number that isn't yours.", href: "/admin/chat-payments" });
  }
  if (i.bankAccounts.length === 0 || i.bankAccounts.some((b) => /^0+$/.test(b.accountNumber))) {
    add({ key: "bank", severity: "blocker", title: "Bank account is a placeholder (0000000000)", detail: "Staff copy these details into the chat when asking for payment.", href: "/admin/chat-payments" });
  }
  if (i.adminAlerts.emails.some((e) => /@mubazzar\.test$/i.test(e))) {
    add({ key: "alerts-test", severity: "blocker", title: "New-order alerts go to a test address", detail: "Replace it with your real email and phone so you hear about every order.", href: "/admin/chat-payments" });
  } else if (i.adminAlerts.emails.length === 0 && i.adminAlerts.phones.length === 0) {
    add({ key: "alerts-empty", severity: "blocker", title: "Nobody is set to receive new-order alerts", detail: "Add an email and/or phone number under New-order alerts.", href: "/admin/chat-payments" });
  }
  if (/^https?:\/\/localhost/i.test(i.siteUrl)) {
    add({ key: "site-url", severity: "blocker", title: "Site address (NEXT_PUBLIC_SITE_URL) is not set", detail: "Search results, the sitemap and tracking links in SMS would point to localhost.", href: null });
  }
  if (!i.services.supabaseAuth) {
    add({ key: "supabase", severity: "blocker", title: "Supabase keys are missing", detail: "Sign-in, accounts and file uploads need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.", href: null });
  }
  if (i.showSampleReviews) {
    add({ key: "sample-reviews", severity: "recommended", title: "Sample reviews are switched on", detail: "Demo reviews are labelled \"Sample review\", but turn them off before launch so only real buyers' reviews show.", href: "/admin/homepage" });
  }
  if (!i.services.sms) {
    add({ key: "sms", severity: "recommended", title: "SMS (Termii) is not connected", detail: "Order confirmations and login codes are only recorded, not sent. Customers can't sign in with a phone code.", href: null });
  }
  if (!i.services.email) {
    add({ key: "email", severity: "recommended", title: "Email (Resend) is not connected", detail: "Order alerts and email login codes are only recorded, not sent.", href: null });
  }
  if (!i.services.metaCapi) {
    add({ key: "meta", severity: "recommended", title: "Meta Pixel / Conversions API keys are missing", detail: "Facebook and Instagram ads can't see which orders came from them.", href: null });
  }
  if (!i.cac) {
    add({ key: "cac", severity: "recommended", title: "CAC registration number is not set", detail: "It is shown in the footer only when it is a real RC/BN number.", href: "/admin/homepage" });
  }
  return out.sort((a, b) => Number(b.severity === "blocker") - Number(a.severity === "blocker"));
}
