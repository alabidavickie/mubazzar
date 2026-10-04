import Image from "next/image";
import { Icon } from "@/components/icons/icon";
import type { HubSummary } from "@/server/services/storefront";

/** Cities of the same-day hubs, e.g. "Ikeja & Wuse II" (from the hubs table, never hard-coded). */
export function hubCities(hubs: HubSummary[]): string {
  const cities = hubs.filter((h) => h.code !== "warehouse" && h.city).map((h) => h.city as string);
  if (cities.length <= 1) return cities[0] ?? "";
  return `${cities.slice(0, -1).join(", ")} & ${cities[cities.length - 1]}`;
}

/** Brand showcase bar at the top of /shop (design: "Uncommon Finds"). */
export function BrandShowcase({ title, subtitle, srTitle }: { title: string; subtitle: string; srTitle?: string }) {
  return (
    <div className="px-4 pt-2 pb-1">
      <div className="flex items-center gap-3 rounded-xl bg-card p-2 shadow-card">
        <Image src="/brand/emblem.webp" alt="" width={56} height={40} className="h-10 w-14 shrink-0 rounded-lg bg-surface-low object-contain" priority />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h1 className="truncate text-headline-sm font-bold text-navy">
              {title}
              {srTitle ? <span className="sr-only"> — {srTitle}</span> : null}
            </h1>
            <Icon name="verified" filled className="shrink-0 text-sm text-bronze" />
          </div>
          {subtitle ? <p className="truncate text-body-sm text-ink-muted">{subtitle}</p> : null}
        </div>
        <div className="shrink-0 rounded-lg bg-gold-soft px-2 py-1 text-center">
          <span className="block text-label-sm font-extrabold text-bronze-ink uppercase">POD</span>
          <span className="block text-[0.625rem] leading-none font-bold text-bronze-ink">via chat</span>
        </div>
      </div>
    </div>
  );
}

/** Page heading used by category, search and deals listings. */
export function ListingHeading({
  title,
  eyebrow,
  description,
  icon,
}: {
  title: string;
  eyebrow?: string;
  description?: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="px-4 pt-3 pb-1">
      <div className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-card">
        {icon ? (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-high text-2xl text-navy">{icon}</span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="text-label-sm tracking-wider text-bronze uppercase">{eyebrow}</p> : null}
          <h1 className="font-display text-headline-md font-bold text-navy">{title}</h1>
          {description ? <p className="text-body-sm text-ink-muted">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}
