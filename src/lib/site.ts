/** Public site helpers safe for client and server. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function absoluteUrl(pathname: string): string {
  if (/^https?:\/\//.test(pathname)) return pathname;
  return `${siteUrl()}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}

export const BRAND = {
  name: "MUBAZZAR",
  tagline: "Tested. Vetted. Delivered.",
} as const;
