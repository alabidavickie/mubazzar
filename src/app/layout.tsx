import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { siteUrl } from "@/lib/site";

const syne = localFont({
  src: "./fonts/syne-latin-wght.woff2",
  variable: "--font-syne",
  weight: "400 800",
  display: "swap",
  preload: false,
});

const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans-latin-wght.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "MUBAZZAR — Uncommon Gadgets & Viral Problem Solvers in Nigeria",
    template: "%s | MUBAZZAR",
  },
  description:
    "Nigeria's home of uncommon gadgets, life-hack tools and viral problem solvers. Tested before dispatch, same-day delivery in Lagos & Abuja, Pay on Delivery available — order and chat with us on WhatsApp.",
  applicationName: "MUBAZZAR",
  manifest: "/manifest.webmanifest",
  openGraph: { type: "website", siteName: "MUBAZZAR", locale: "en_NG" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0E294B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${syne.variable} ${jakarta.variable}`}>
      <body className="min-h-dvh bg-surface font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
