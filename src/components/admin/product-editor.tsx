"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/icons/icon";
import { saveProductAction, uploadCatalogImageAction, uploadProductImageAction, type SaveProductResult } from "@/app/actions/admin-catalog";
import type { ProductInput } from "@/lib/schemas/product";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/cn";

type Bundle = NonNullable<ProductInput["bundles"]>[number];
type Gift = NonNullable<ProductInput["gift"]>;

export interface EditorImage {
  id: string;
  url: string;
  alt: string;
}

const EMPTY_BUNDLE: Bundle = { id: null, label: "", shortLabel: "", description: "", quantity: 1, price: "", compareAt: "", promoPrice: "", promoEndsAt: "", tag: "", sideTag: "", note: "", isPopular: false, isActive: true };

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
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

function RowTools({ onUp, onDown, onRemove, label }: { onUp?: () => void; onDown?: () => void; onRemove: () => void; label: string }) {
  return (
    <span className="flex gap-1">
      <button type="button" onClick={onUp} disabled={!onUp} className="flex size-9 items-center justify-center rounded-md bg-surface-high disabled:opacity-30" aria-label={`Move ${label} up`}>
        ↑
      </button>
      <button type="button" onClick={onDown} disabled={!onDown} className="flex size-9 items-center justify-center rounded-md bg-surface-high disabled:opacity-30" aria-label={`Move ${label} down`}>
        ↓
      </button>
      <button type="button" onClick={onRemove} className="flex size-9 items-center justify-center rounded-md bg-urgent-soft text-urgent-ink" aria-label={`Remove ${label}`}>
        <Icon name="delete" className="text-base" />
      </button>
    </span>
  );
}

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

export function ProductEditor({
  initial,
  initialImages,
  categories,
  hubs,
  reserved,
}: {
  initial: ProductInput;
  initialImages: EditorImage[];
  categories: { id: string; name: string }[];
  hubs: { id: string; code: string; name: string }[];
  reserved: Record<string, number>;
}) {
  const router = useRouter();
  const [v, setV] = useState<ProductInput>(initial);
  const [images, setImages] = useState<EditorImage[]>(initialImages);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SaveProductResult | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const giftFileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductInput>(k: K, val: ProductInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (path: string) => (result && !result.ok ? result.fieldErrors?.[path] : undefined);
  const bundles = v.bundles ?? [];
  const features = v.features ?? [];
  const specs = v.specs ?? [];
  const faqs = v.faqs ?? [];
  const stock = v.stock ?? [];
  const setBundle = (i: number, patch: Partial<Bundle>) => set("bundles", bundles.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const save = () =>
    start(async () => {
      const payload: ProductInput = { ...v, images: images.map((i) => ({ id: i.id, alt: i.alt })) };
      const r = await saveProductAction(payload);
      setResult(r);
      if (r.ok) {
        if (!initial.id) router.push(`/admin/products/${r.id}`);
        else {
          if (r.values) setV(r.values);
          if (r.images) setImages(r.images);
        }
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

  const upload = async (file: File, kind: "product" | "gift") => {
    const fd = new FormData();
    fd.set("file", file);
    if (kind === "product") {
      fd.set("productId", initial.id ?? "");
      fd.set("alt", v.name);
      const r = await uploadProductImageAction(fd);
      if (r.ok && r.id) setImages((list) => [...list, { id: r.id!, url: r.url, alt: r.alt ?? "" }]);
      setUploadMsg(r.ok ? "Photo uploaded — add a description, then save." : r.error);
    } else {
      const r = await uploadCatalogImageAction(fd);
      if (r.ok && v.gift) set("gift", { ...v.gift, imageUrl: r.url });
      setUploadMsg(r.ok ? "Gift photo uploaded." : r.error);
    }
  };

  return (
    <form
      className="flex flex-col gap-4 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      data-testid="product-editor"
    >
      {result ? (
        <p
          role={result.ok ? "status" : "alert"}
          className={cn("rounded-lg px-3 py-2 text-label-md", result.ok ? "bg-emerald-soft text-emerald-ink" : "bg-urgent-soft text-urgent-ink")}
          data-testid={result.ok ? "save-ok" : "save-error"}
        >
          {result.ok ? result.message : result.error}
        </p>
      ) : null}

      <Section title="Basics">
        <Field label="Product name" required error={err("name")}>
          {({ id, invalid }) => (
            <Input
              id={id}
              value={v.name}
              aria-invalid={invalid}
              onChange={(e) => {
                const name = e.target.value;
                setV((p) => ({ ...p, name, slug: slugTouched ? p.slug : slugify(name) }));
              }}
            />
          )}
        </Field>
        <Field label="URL slug" required error={err("slug")} hint={`Shop link: /p/${v.slug || "…"} · Ad landing page: /lp/${v.slug || "…"}`}>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category">
            {({ id }) => (
              <Select id={id} value={v.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}>
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex min-h-11 items-center gap-2 text-label-md">
              <input type="checkbox" checked={v.isActive ?? true} onChange={(e) => set("isActive", e.target.checked)} className="size-5 accent-navy" />
              Visible in the shop
            </label>
            <label className="flex min-h-11 items-center gap-2 text-label-md">
              <input type="checkbox" checked={v.podAvailable ?? true} onChange={(e) => set("podAvailable", e.target.checked)} className="size-5 accent-navy" />
              Pay on Delivery can be arranged in chat
            </label>
          </div>
        </div>
        <Field label="Short description" hint="One line under the name (max 240 characters)" error={err("shortDescription")}>
          {({ id, describedBy }) => <Input id={id} value={v.shortDescription ?? ""} aria-describedby={describedBy} onChange={(e) => set("shortDescription", e.target.value)} />}
        </Field>
        <Field label="Full description" error={err("description")}>
          {({ id }) => <Textarea id={id} rows={5} value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} />}
        </Field>
      </Section>

      <Section title="Price" hint="Prices in naira. The server recomputes every order total from these values.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Price (₦)" required error={err("price")}>
            {({ id, invalid }) => <Input id={id} inputMode="decimal" value={v.price} aria-invalid={invalid} onChange={(e) => set("price", e.target.value)} />}
          </Field>
          <Field label="Compare-at price (₦)" hint="Only a real previous price" error={err("compareAt")}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} inputMode="decimal" value={v.compareAt ?? ""} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => set("compareAt", e.target.value)} />
            )}
          </Field>
          <Field label="Warranty (months)" error={err("warrantyMonths")}>
            {({ id }) => <Input id={id} type="number" min={0} value={String(v.warrantyMonths ?? 0)} onChange={(e) => set("warrantyMonths", Number(e.target.value))} />}
          </Field>
        </div>
      </Section>

      <Section title="Photos" hint="The first photo is the main image. Up to 12. JPG, PNG or WebP, 5MB max.">
        {!initial.id ? <p className="text-body-sm text-ink-muted">Create the product first, then add photos.</p> : null}
        {images.length > 0 ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="editor-images">
            {images.map((img, i) => (
              <li key={img.id} className="flex gap-2 rounded-lg bg-surface-low p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an uploaded file */}
                <img src={img.url} alt="" className="size-20 shrink-0 rounded-md object-cover" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <label className="text-label-sm text-ink-muted">
                    Description (alt text) {i === 0 ? "· main photo" : ""}
                    <Input value={img.alt} onChange={(e) => setImages((l) => l.map((x) => (x.id === img.id ? { ...x, alt: e.target.value } : x)))} className="py-1.5 text-body-md" />
                  </label>
                  <RowTools
                    label={`photo ${i + 1}`}
                    onUp={i > 0 ? () => setImages((l) => move(l, i, -1)) : undefined}
                    onDown={i < images.length - 1 ? () => setImages((l) => move(l, i, 1)) : undefined}
                    onRemove={() => setImages((l) => l.filter((x) => x.id !== img.id))}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {initial.id ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Upload a product photo"
              className="text-body-sm"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await upload(f, "product");
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
          </div>
        ) : null}
        {uploadMsg ? (
          <p role="status" className="text-body-sm text-navy" data-testid="upload-msg">
            {uploadMsg}
          </p>
        ) : null}
      </Section>

      <Section title="Bundles (multi-packs)" hint="Each bundle is priced in the database and recomputed at checkout. A promo price needs a real end date; after it, the regular price applies automatically.">
        {err("bundles") ? (
          <p role="alert" className="text-body-sm font-semibold text-urgent">
            {err("bundles")}
          </p>
        ) : null}
        {bundles.map((b, i) => (
          <fieldset key={b.id ?? `new-${i}`} className={cn("flex flex-col gap-2 rounded-lg border border-line p-3", !b.isActive && "opacity-60")} data-testid="bundle-editor">
            <legend className="flex w-full items-center justify-between gap-2 px-1 text-label-md font-bold text-navy">
              Bundle {i + 1}
              <RowTools
                label={`bundle ${i + 1}`}
                onUp={i > 0 ? () => set("bundles", move(bundles, i, -1)) : undefined}
                onDown={i < bundles.length - 1 ? () => set("bundles", move(bundles, i, 1)) : undefined}
                onRemove={() => set("bundles", bundles.filter((_, j) => j !== i))}
              />
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <Field label="Bundle name" required className="sm:col-span-3" error={err(`bundles.${i}.label`)}>
                {({ id }) => <Input id={id} value={b.label} placeholder="2x Turbo Vacuum Sets (His & Hers)" onChange={(e) => setBundle(i, { label: e.target.value })} />}
              </Field>
              <Field label="Units" required error={err(`bundles.${i}.quantity`)}>
                {({ id }) => <Input id={id} type="number" min={1} max={50} value={String(b.quantity)} onChange={(e) => setBundle(i, { quantity: Number(e.target.value) })} />}
              </Field>
              <Field label="Price (₦)" required error={err(`bundles.${i}.price`)}>
                {({ id }) => <Input id={id} inputMode="decimal" value={b.price} onChange={(e) => setBundle(i, { price: e.target.value })} />}
              </Field>
              <Field label="Compare-at (₦)" error={err(`bundles.${i}.compareAt`)}>
                {({ id }) => <Input id={id} inputMode="decimal" value={b.compareAt ?? ""} onChange={(e) => setBundle(i, { compareAt: e.target.value })} />}
              </Field>
              <Field label="Promo price (₦)" error={err(`bundles.${i}.promoPrice`)}>
                {({ id }) => <Input id={id} inputMode="decimal" value={b.promoPrice ?? ""} onChange={(e) => setBundle(i, { promoPrice: e.target.value })} />}
              </Field>
              <Field label="Promo ends (Lagos time)" error={err(`bundles.${i}.promoEndsAt`)}>
                {({ id }) => <Input id={id} type="datetime-local" value={b.promoEndsAt ?? ""} onChange={(e) => setBundle(i, { promoEndsAt: e.target.value })} className="py-2" />}
              </Field>
              <Field label="Chat label" hint="Short name used in WhatsApp messages" className="sm:col-span-2">
                {({ id, describedBy }) => <Input id={id} value={b.shortLabel ?? ""} aria-describedby={describedBy} onChange={(e) => setBundle(i, { shortLabel: e.target.value })} />}
              </Field>
              <Field label="What's included" className="sm:col-span-2">
                {({ id }) => <Input id={id} value={b.description ?? ""} onChange={(e) => setBundle(i, { description: e.target.value })} />}
              </Field>
              <Field label="Top tag" hint="Label only, e.g. MOST POPULAR" error={err(`bundles.${i}.tag`)}>
                {({ id, describedBy }) => <Input id={id} value={b.tag ?? ""} aria-describedby={describedBy} onChange={(e) => setBundle(i, { tag: e.target.value })} />}
              </Field>
              <Field label="Side tag" hint="e.g. Best Value">
                {({ id, describedBy }) => <Input id={id} value={b.sideTag ?? ""} aria-describedby={describedBy} onChange={(e) => setBundle(i, { sideTag: e.target.value })} />}
              </Field>
              <Field label="Note" className="sm:col-span-2">
                {({ id }) => <Input id={id} value={b.note ?? ""} onChange={(e) => setBundle(i, { note: e.target.value })} />}
              </Field>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex min-h-10 items-center gap-2 text-label-md">
                <input type="checkbox" checked={b.isPopular ?? false} onChange={(e) => setBundle(i, { isPopular: e.target.checked })} className="size-5 accent-navy" />
                Most popular (highlighted)
              </label>
              <label className="flex min-h-10 items-center gap-2 text-label-md">
                <input type="checkbox" checked={b.isActive ?? true} onChange={(e) => setBundle(i, { isActive: e.target.checked })} className="size-5 accent-navy" />
                On sale
              </label>
            </div>
          </fieldset>
        ))}
        <Button variant="soft" onClick={() => set("bundles", [...bundles, { ...EMPTY_BUNDLE, quantity: bundles.length + 1 }])} disabled={bundles.length >= 6}>
          <Icon name="add" /> Add bundle
        </Button>
      </Section>

      <Section title="Free gift" hint="Shown only while it's live. Leave the end date empty for an ongoing gift.">
        <label className="flex min-h-10 items-center gap-2 text-label-md">
          <input
            type="checkbox"
            checked={Boolean(v.gift)}
            onChange={(e) => set("gift", e.target.checked ? ({ name: "", value: "", imageUrl: "", conditions: "", endsAt: "" } satisfies Gift) : null)}
            className="size-5 accent-navy"
          />
          This product comes with a free gift
        </label>
        {v.gift ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Gift name" required error={err("gift.name")}>
              {({ id }) => <Input id={id} value={v.gift!.name} onChange={(e) => set("gift", { ...v.gift!, name: e.target.value })} />}
            </Field>
            <Field label="Value (₦)" hint="Its real retail value" error={err("gift.value")}>
              {({ id, describedBy }) => <Input id={id} inputMode="decimal" value={v.gift!.value ?? ""} aria-describedby={describedBy} onChange={(e) => set("gift", { ...v.gift!, value: e.target.value })} />}
            </Field>
            <Field label="Conditions">{({ id }) => <Input id={id} value={v.gift!.conditions ?? ""} onChange={(e) => set("gift", { ...v.gift!, conditions: e.target.value })} />}</Field>
            <Field label="Gift ends (Lagos time)" error={err("gift.endsAt")}>
              {({ id }) => <Input id={id} type="datetime-local" value={v.gift!.endsAt ?? ""} onChange={(e) => set("gift", { ...v.gift!, endsAt: e.target.value })} className="py-2" />}
            </Field>
            <div className="flex items-center gap-2 sm:col-span-2">
              {v.gift.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                <img src={v.gift.imageUrl} alt="" className="size-14 rounded-md object-cover" />
              ) : null}
              <input
                ref={giftFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Upload a gift photo"
                className="text-body-sm"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await upload(f, "gift");
                  if (giftFileRef.current) giftFileRef.current.value = "";
                }}
              />
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Feature blocks" hint="Icon (Material Symbols name), title and a short explanation.">
        {features.map((f, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-line p-3 sm:grid-cols-6" data-testid="feature-editor">
            <Field label="Icon" className="sm:col-span-1">
              {({ id }) => <Input id={id} value={f.icon ?? ""} placeholder="check_circle" onChange={(e) => set("features", features.map((x, j) => (j === i ? { ...x, icon: e.target.value } : x)))} />}
            </Field>
            <Field label="Title" className="sm:col-span-2" error={err(`features.${i}.title`)}>
              {({ id }) => <Input id={id} value={f.title} onChange={(e) => set("features", features.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />}
            </Field>
            <Field label="Description" className="sm:col-span-3" error={err(`features.${i}.description`)}>
              {({ id }) => <Input id={id} value={f.description} onChange={(e) => set("features", features.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />}
            </Field>
            <RowTools
              label={`feature ${i + 1}`}
              onUp={i > 0 ? () => set("features", move(features, i, -1)) : undefined}
              onDown={i < features.length - 1 ? () => set("features", move(features, i, 1)) : undefined}
              onRemove={() => set("features", features.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <Button variant="soft" onClick={() => set("features", [...features, { icon: "check_circle", title: "", description: "" }])} disabled={features.length >= 12}>
          <Icon name="add" /> Add feature
        </Button>
      </Section>

      <Section title="Specifications">
        {specs.map((s, i) => (
          <div key={i} className="flex items-end gap-2">
            <Field label="Label" className="flex-1">
              {({ id }) => <Input id={id} value={s.label} placeholder="Battery" onChange={(e) => set("specs", specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />}
            </Field>
            <Field label="Value" className="flex-[2]">
              {({ id }) => <Input id={id} value={s.value} placeholder="2,000 mAh" onChange={(e) => set("specs", specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />}
            </Field>
            <RowTools label={`spec ${i + 1}`} onRemove={() => set("specs", specs.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button variant="soft" onClick={() => set("specs", [...specs, { label: "", value: "" }])} disabled={specs.length >= 30}>
          <Icon name="add" /> Add specification
        </Button>
      </Section>

      <Section title="FAQs">
        {faqs.map((f, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-line p-3">
            <Field label="Question" error={err(`faqs.${i}.question`)}>
              {({ id }) => <Input id={id} value={f.question} onChange={(e) => set("faqs", faqs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />}
            </Field>
            <Field label="Answer" error={err(`faqs.${i}.answer`)}>
              {({ id }) => <Textarea id={id} rows={2} value={f.answer} onChange={(e) => set("faqs", faqs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />}
            </Field>
            <RowTools
              label={`FAQ ${i + 1}`}
              onUp={i > 0 ? () => set("faqs", move(faqs, i, -1)) : undefined}
              onDown={i < faqs.length - 1 ? () => set("faqs", move(faqs, i, 1)) : undefined}
              onRemove={() => set("faqs", faqs.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <Button variant="soft" onClick={() => set("faqs", [...faqs, { question: "", answer: "" }])} disabled={faqs.length >= 20}>
          <Icon name="add" /> Add FAQ
        </Button>
      </Section>

      <Section title="Stock per hub" hint="On hand = physical units. Units reserved for open orders can't be removed.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {hubs.map((h) => {
            const i = stock.findIndex((s) => s.hubId === h.id);
            const row = i >= 0 ? stock[i]! : { hubId: h.id, onHand: 0, threshold: 10 };
            const update = (patch: Partial<typeof row>) =>
              set("stock", i >= 0 ? stock.map((s, j) => (j === i ? { ...s, ...patch } : s)) : [...stock, { ...row, ...patch }]);
            return (
              <fieldset key={h.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
                <legend className="px-1 text-label-md font-bold text-navy">{h.name}</legend>
                <Field label="On hand" hint={reserved[h.id] ? `${reserved[h.id]} reserved` : undefined}>
                  {({ id, describedBy }) => <Input id={id} type="number" min={reserved[h.id] ?? 0} value={String(row.onHand)} aria-describedby={describedBy} onChange={(e) => update({ onHand: Number(e.target.value) })} />}
                </Field>
                <Field label="Low-stock alert at">
                  {({ id }) => <Input id={id} type="number" min={0} value={String(row.threshold)} onChange={(e) => update({ threshold: Number(e.target.value) })} />}
                </Field>
              </fieldset>
            );
          })}
        </div>
      </Section>

      <Section title="Merchandising" hint="Short copy on product cards. Words only — never invented numbers.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Image badge">{({ id }) => <Input id={id} value={v.imageBadge ?? ""} placeholder="Selling Fast" onChange={(e) => set("imageBadge", e.target.value)} />}</Field>
          <Field label="Badge style">
            {({ id }) => (
              <Select id={id} value={v.imageBadgeStyle ?? "navy"} onChange={(e) => set("imageBadgeStyle", e.target.value as ProductInput["imageBadgeStyle"])}>
                {["navy", "emerald", "gold", "bronze", "red"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Badge icon" error={err("imageBadgeIcon")}>{({ id }) => <Input id={id} value={v.imageBadgeIcon ?? ""} onChange={(e) => set("imageBadgeIcon", e.target.value)} />}</Field>
          <Field label="Perk">{({ id }) => <Input id={id} value={v.perkText ?? ""} placeholder="No Drilling Needed" onChange={(e) => set("perkText", e.target.value)} />}</Field>
          <Field label="Perk icon" error={err("perkIcon")}>{({ id }) => <Input id={id} value={v.perkIcon ?? ""} onChange={(e) => set("perkIcon", e.target.value)} />}</Field>
          <Field label="Perk style">
            {({ id }) => (
              <Select id={id} value={v.perkStyle ?? "gold"} onChange={(e) => set("perkStyle", e.target.value as ProductInput["perkStyle"])}>
                <option value="gold">gold</option>
                <option value="neutral">neutral</option>
              </Select>
            )}
          </Field>
          <Field label="Delivery note">{({ id }) => <Input id={id} value={v.deliveryNote ?? ""} placeholder="Lagos 24h Delivery" onChange={(e) => set("deliveryNote", e.target.value)} />}</Field>
          <Field label="Delivery note icon" error={err("deliveryNoteIcon")}>{({ id }) => <Input id={id} value={v.deliveryNoteIcon ?? ""} onChange={(e) => set("deliveryNoteIcon", e.target.value)} />}</Field>
          <Field label="Viral Problem Solvers rank" hint="1 = first; empty = not featured">
            {({ id, describedBy }) => (
              <Input id={id} type="number" min={1} value={v.curatedRank == null ? "" : String(v.curatedRank)} aria-describedby={describedBy} onChange={(e) => set("curatedRank", e.target.value ? Number(e.target.value) : null)} />
            )}
          </Field>
          <Field label="Featured label">{({ id }) => <Input id={id} value={v.curatedLabel ?? ""} placeholder="TOP VIRAL" onChange={(e) => set("curatedLabel", e.target.value)} />}</Field>
        </div>
      </Section>

      <Section title="Search & SEO">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="SEO title" hint="Up to 70 characters" error={err("seoTitle")}>
            {({ id, describedBy }) => <Input id={id} value={v.seoTitle ?? ""} aria-describedby={describedBy} onChange={(e) => set("seoTitle", e.target.value)} />}
          </Field>
          <Field label="SKU" error={err("sku")}>{({ id }) => <Input id={id} value={v.sku ?? ""} onChange={(e) => set("sku", e.target.value)} />}</Field>
          <Field label="SEO description" hint="Up to 170 characters" className="sm:col-span-2" error={err("seoDescription")}>
            {({ id, describedBy }) => <Textarea id={id} rows={2} value={v.seoDescription ?? ""} aria-describedby={describedBy} onChange={(e) => set("seoDescription", e.target.value)} />}
          </Field>
          <Field label="Search tags" hint="Comma separated, e.g. car, cleaning, cordless" className="sm:col-span-2">
            {({ id, describedBy }) => <Input id={id} value={v.tags ?? ""} aria-describedby={describedBy} onChange={(e) => set("tags", e.target.value)} />}
          </Field>
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-2 border-t border-line bg-card/95 px-4 py-3 backdrop-blur lg:left-60">
        {initial.id && v.isActive ? (
          <span className="mr-auto flex flex-wrap gap-x-4 gap-y-1">
            <a href={`/p/${initial.slug}`} target="_blank" rel="noopener" className="text-label-md text-navy underline">
              View in shop
            </a>
            <a href={`/lp/${initial.slug}`} target="_blank" rel="noopener" className="text-label-md text-navy underline">
              Ad landing page
            </a>
          </span>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          <Icon name="check" /> {pending ? "Saving…" : initial.id ? "Save product" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
