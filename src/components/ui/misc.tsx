import { cx } from "@/lib/cx";
import { Icon } from "@/components/icons/icon";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-lg bg-surface-high", className)} />;
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-xl border border-line-soft bg-card shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  eyebrow,
  action,
  as: Tag = "h2",
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cx("mb-3 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-0.5">{eyebrow}</div> : null}
        <Tag className="text-headline-sm font-bold text-navy">{title}</Tag>
        {subtitle ? <p className="text-body-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Accordion({
  items,
  className,
}: {
  items: { question: string; answer: string }[];
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {items.map((item) => (
        <details key={item.question} className="group rounded-xl bg-card shadow-card">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 p-4 text-label-lg font-bold text-navy">
            <span>{item.question}</span>
            <Icon name="expand_more" className="text-2xl transition-transform group-open:rotate-180" />
          </summary>
          <p className="px-4 pb-4 text-body-md leading-relaxed text-ink-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function EmptyState({
  icon = "search",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-10 text-center shadow-card">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-container text-navy">
        <Icon name={icon} className="text-3xl" />
      </span>
      <h2 className="text-headline-sm font-bold text-navy">{title}</h2>
      {body ? <p className="max-w-sm text-body-md text-ink-muted">{body}</p> : null}
      {action}
    </div>
  );
}

/** Tiny label for seeded sample data so it is never mistaken for a real customer review. */
export function SampleTag() {
  return (
    <span className="rounded bg-surface-high px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-ink-muted">
      Sample review
    </span>
  );
}
