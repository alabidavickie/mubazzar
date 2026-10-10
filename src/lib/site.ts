/** Public site helpers safe for client and server. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  // Vercel injects the production domain (no protocol), so canonical URLs and the sitemap stay correct
  // even before NEXT_PUBLIC_SITE_URL is set. Server-only: this variable is not exposed to the browser.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

export function absoluteUrl(pathname: string): string {
  if (/^https?:\/\//.test(pathname)) return pathname;
  return `${siteUrl()}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}

export const BRAND = {
  name: "MUBAZZAR",
  tagline: "Tested. Vetted. Delivered.",
} as const;
