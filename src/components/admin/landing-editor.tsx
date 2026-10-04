"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/icons/icon";
import { saveLandingAction, type SaveLandingResult } from "@/app/actions/admin-landing";
import { uploadCatalogImageAction } from "@/app/actions/admin-catalog";
import type { LandingInput } from "@/lib/schemas/landing";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/cn";

type Section = NonNullable<LandingInput["sections"]>[number];

function Box({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card" aria-label={title}>
      <div>
        <h2 className="text-label-lg font-bold text-navy">{title}</h2>
        {hint ? <p className="text-body-sm text-ink-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Landing page builder. Prices, bundles, gift, photos, stock, reviews and the countdown all come from
 * the chosen product (edit them on the product) — this page only holds the ad copy and layout.
 */
export function LandingEditor({ initial, products }: { initial: LandingInput; products: { id: string; name: string; slug: string; isActive: boolean }[] }) {
  const router = useRouter();
  const [v, setV] = useState<LandingInput>(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SaveLandingResult | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const set = <K extends keyof LandingInput>(k: K, val: LandingInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (path: string) => (result && !result.ok ? result.fieldErrors?.[path] : undefined);
  const sections = v.sections ?? [];
  const setSection = (i: number, patch: Partial<Section>) => set("sections", sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const text = (k: keyof LandingInput, label: string, opts: { hint?: string; area?: boolean; placeholder?: string; required?: boolean } = {}) => (
    <Field label={label} hint={opts.hint} error={err(String(k))} required={opts.required}>
      {({ id, describedBy, invalid }) =>
        opts.area ? (
          <Textarea id={id} rows={2} value={(v[k] as string) ?? ""} placeholder={opts.placeholder} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set(k, e.target.value as never)} />
        ) : (
          <Input id={id} value={(v[k] as string) ?? ""} placeholder={opts.placeholder} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set(k, e.target.value as never)} />
        )
      }
    </Field>
  );
  const uploadInto = async (k: "videoPosterUrl" | "ogImageUrl", file: File) => {
    setUploading(k);
    const fd = new FormData();
    fd.set("file", file);
    const r = await uploadCatalogImageAction(fd);
    setUploading(null);
    if (r.ok) set(k, r.url);
    else setResult({ ok: false, error: r.error });
  };

  return (
    <form
      className="flex flex-col gap-4 pb-24"
      data-testid="landing-editor"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveLandingAction(v);
          setResult(r);
          if (r.ok) {
            if (!initial.id) router.push(`/admin/landing-pages/${r.id}`);
          } else window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }}
    >
      {result ? (
        <p role={result.ok ? "status" : "alert"} className={cn("rounded-lg px-3 py-2 text-label-md", result.ok ? "bg-emerald-soft text-emerald-ink" : "bg-urgent-soft text-urgent-ink")} data-testid={result.ok ? "save-ok" : "save-error"}>
          {result.ok ? result.message : result.error}
        </p>
      ) : null}

      <Box title="Page" hint="Price, bundles, gift, photos, stock, reviews and the promo countdown come from the product.">
        <Field label="Product" required error={err("productId")}>
          {({ id }) => (
            <Select id={id} value={v.productId} onChange={(e) => set("productId", e.target.value)}>
              <option value="" disabled>
                Choose a product
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isActive ? "" : " (hidden in shop)"}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Page link" required error={err("slug")} hint={`Ad URL: /lp/${v.slug || "…"}`}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={v.slug}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase());
              }}
            />
          )}
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-label-md">
          <input type="checkbox" checked={v.isPublished ?? false} onChange={(e) => set("isPublished", e.target.checked)} className="size-5 accent-navy" />
          Published (live for ad traffic)
        </label>
      </Box>

      <Box title="Hook & headline" hint="Headline supports ~~strikethrough~~ and **bold**.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {text("hookLabel", "Hook label", { placeholder: "PROMO ALERT" })}
          <div className="sm:col-span-2">{text("hookBanner", "Hook banner", { placeholder: "Free car perfume with every order | Pay on Delivery in chat", hint: "No typed % — the real discount is shown automatically" })}</div>
        </div>
        {text("trendBadge", "Trend badge", { placeholder: "Tested by our Lagos team" })}
        <Field label="Headline" required error={err("headline")}>
          {({ id, invalid }) => (
            <Input
              id={id}
              value={v.headline}
              aria-invalid={invalid}
              onChange={(e) => {
                const headline = e.target.value;
                setV((p) => ({ ...p, headline, slug: slugTouched ? p.slug : slugify(headline).split("-").slice(0, 6).join("-") }));
              }}
            />
          )}
        </Field>
        {text("subheadline", "Subheadline", { area: true })}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {text("heroOverlayText", "Photo caption", { placeholder: "9,000Pa Turbo Vortex Engine" })}
          {text("heroOverlayIcon", "Caption icon", { placeholder: "speed" })}
          {text("warrantyBadge", "Warranty badge", { placeholder: "1-Year Warranty" })}
          {text("regionsText", "Regions", { placeholder: "Lagos • Abuja • PH • Kano" })}
        </div>
        <Field label="Campaign end (Lagos time)" hint="Optional. The countdown always follows the product's real promo end; after this date the page says the promo ended." error={err("campaignEndsAt")}>
          {({ id, describedBy }) => <Input id={id} type="datetime-local" value={v.campaignEndsAt ?? ""} aria-describedby={describedBy} onChange={(e) => set("campaignEndsAt", e.target.value)} className="py-2" />}
        </Field>
      </Box>

      <Box title="Features & video">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {text("featuresTitle", "Features title", { placeholder: "Why Nigerian Drivers Love This" })}
          {text("featuresSubtitle", "Features subtitle")}
          {text("videoUrl", "Video link (YouTube or .mp4)", { placeholder: "https://…" })}
          {text("videoTitle", "Video title")}
          {text("videoSubtitle", "Video subtitle")}
          <div className="flex flex-col gap-1">
            {text("videoPosterUrl", "Video poster image")}
            <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload video poster" className="text-body-sm" onChange={(e) => e.target.files?.[0] && uploadInto("videoPosterUrl", e.target.files[0])} />
          </div>
        </div>
        {uploading ? <p className="text-body-sm text-ink-muted">Uploading…</p> : null}
      </Box>

      <Box title="Extra sections" hint="Trust blocks (icon + title + line) or a paragraph of text, shown after the bundles.">
        {sections.map((s, i) => (
          <fieldset key={i} className="flex flex-col gap-2 rounded-lg border border-line p-3">
            <legend className="flex w-full items-center justify-between px-1 text-label-md font-bold text-navy">
              {s.kind === "trust_matrix" ? "Trust blocks" : "Text"}
              <button type="button" onClick={() => set("sections", sections.filter((_, j) => j !== i))} className="flex size-9 items-center justify-center rounded-md bg-urgent-soft text-urgent-ink" aria-label={`Remove section ${i + 1}`}>
                <Icon name="delete" className="text-base" />
              </button>
            </legend>
            <Field label="Title">{({ id }) => <Input id={id} value={s.title ?? ""} onChange={(e) => setSection(i, { title: e.target.value })} />}</Field>
            {s.kind === "custom_text" ? (
              <Field label="Text" hint="Blank line = new paragraph; **bold** allowed">
                {({ id, describedBy }) => <Textarea id={id} rows={4} value={s.body ?? ""} aria-describedby={describedBy} onChange={(e) => setSection(i, { body: e.target.value })} />}
              </Field>
            ) : (
              <>
                {(s.items ?? []).map((it, k) => (
                  <div key={k} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                    <Field label="Icon">{({ id }) => <Input id={id} value={it.icon ?? ""} onChange={(e) => setSection(i, { items: (s.items ?? []).map((x, j) => (j === k ? { ...x, icon: e.target.value } : x)) })} />}</Field>
                    <Field label="Title" className="sm:col-span-2">{({ id }) => <Input id={id} value={it.title} onChange={(e) => setSection(i, { items: (s.items ?? []).map((x, j) => (j === k ? { ...x, title: e.target.value } : x)) })} />}</Field>
                    <Field label="Line" className="sm:col-span-3">{({ id }) => <Input id={id} value={it.body} onChange={(e) => setSection(i, { items: (s.items ?? []).map((x, j) => (j === k ? { ...x, body: e.target.value } : x)) })} />}</Field>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setSection(i, { items: [...(s.items ?? []), { icon: "verified", title: "", body: "" }] })}>
                  <Icon name="add" /> Add block
                </Button>
              </>
            )}
            <label className="flex items-center gap-2 text-label-md">
              <input type="checkbox" checked={s.isVisible ?? true} onChange={(e) => setSection(i, { isVisible: e.target.checked })} className="size-5 accent-navy" /> Visible
            </label>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" onClick={() => set("sections", [...sections, { kind: "trust_matrix", title: "", body: "", items: [{ icon: "verified", title: "", body: "" }], isVisible: true }])}>
            <Icon name="add" /> Trust blocks
          </Button>
          <Button variant="soft" onClick={() => set("sections", [...sections, { kind: "custom_text", title: "", body: "", items: [], isVisible: true }])}>
            <Icon name="add" /> Text section
          </Button>
        </div>
      </Box>

      <Box title="Sharing" hint="The order button always reads like “Place Order & Pay on WhatsApp” (it follows the customer’s chosen channel).">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {text("seoTitle", "Browser/share title")}
          <div className="sm:col-span-2">{text("seoDescription", "Share description", { area: true })}</div>
          <div className="flex flex-col gap-1">
            {text("ogImageUrl", "Share image")}
            <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload share image" className="text-body-sm" onChange={(e) => e.target.files?.[0] && uploadInto("ogImageUrl", e.target.files[0])} />
          </div>
        </div>
      </Box>

      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-2 border-t border-line bg-card/95 px-4 py-3 backdrop-blur lg:left-60">
        {initial.id ? (
          <a href={`/lp/${initial.slug}?preview=1`} target="_blank" rel="noopener" className="mr-auto inline-flex min-h-10 items-center gap-1 text-label-md text-navy underline" data-testid="preview-link">
            <Icon name="visibility" className="text-base" /> Preview
          </a>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          <Icon name="check" /> {pending ? "Saving…" : initial.id ? "Save page" : "Create page"}
        </Button>
      </div>
    </form>
  );
}
