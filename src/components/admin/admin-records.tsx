"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  createTeamMemberAction,
  moderateReviewAction,
  saveCategoryAction,
  saveChannelAction,
  saveZoneAction,
  updateTeamMemberAction,
  type SettingsResult,
} from "@/app/actions/admin-settings";
import { cn } from "@/lib/cn";

/** Small record editors for the admin settings screens (chat channels, zones, categories, reviews, team). */

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SettingsResult | null>(null);
  const run = (fn: () => Promise<SettingsResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) {
        onOk?.();
        router.refresh();
      }
    });
  return { pending, result, run };
}

function Msg({ result }: { result: SettingsResult | null }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={cn("text-label-sm", result.ok ? "text-emerald-ink" : "text-urgent-ink")}>
      {result.ok ? result.message : result.error}
    </p>
  );
}

const check = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
  <label className="flex min-h-11 items-center gap-2 text-label-md">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-navy" />
    {label}
  </label>
);

export interface ChannelValues {
  id?: string | null;
  kind: "whatsapp" | "instagram" | "messenger" | "telegram" | "phone";
  label: string;
  handle: string;
  hubCode: string | null;
  weight: number;
  isEnabled: boolean;
  sortOrder: number;
}

export function ChannelForm({ initial, hubs }: { initial: ChannelValues; hubs: { code: string; name: string }[] }) {
  const [v, setV] = useState(initial);
  const { pending, result, run } = useSave();
  const set = (p: Partial<ChannelValues>) => setV((x) => ({ ...x, ...p }));
  return (
    <form
      className="grid grid-cols-2 gap-2 rounded-lg border border-line p-3 sm:grid-cols-6"
      data-testid="channel-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveChannelAction(v), () => !initial.id && setV(initial));
      }}
    >
      <Field label="Channel">
        {({ id }) => (
          <Select id={id} value={v.kind} onChange={(e) => set({ kind: e.target.value as ChannelValues["kind"] })}>
            {["whatsapp", "instagram", "messenger", "telegram", "phone"].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Label">{({ id }) => <Input id={id} value={v.label} onChange={(e) => set({ label: e.target.value })} />}</Field>
      <Field label={v.kind === "whatsapp" || v.kind === "phone" ? "Number" : "Username / page"}>
        {({ id }) => <Input id={id} value={v.handle} onChange={(e) => set({ handle: e.target.value })} />}
      </Field>
      <Field label="Hub (WhatsApp routing)">
        {({ id }) => (
          <Select id={id} value={v.hubCode ?? ""} onChange={(e) => set({ hubCode: e.target.value || null })}>
            <option value="">Any hub</option>
            {hubs.map((h) => (
              <option key={h.code} value={h.code}>
                {h.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Weight">{({ id }) => <Input id={id} type="number" min={1} value={String(v.weight)} onChange={(e) => set({ weight: Number(e.target.value) })} />}</Field>
      <div className="flex flex-col justify-end">{check("Enabled", v.isEnabled, (b) => set({ isEnabled: b }))}</div>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-6">
        <Button type="submit" size="sm" disabled={pending}>
          {initial.id ? "Save" : "Add channel"}
        </Button>
        <Msg result={result} />
      </div>
    </form>
  );
}

export interface ZoneValues {
  state: string;
  displayName: string;
  fee: string;
  etaMinDays: number;
  etaMaxDays: number;
  sameDayEnabled: boolean;
  hubCode: string;
  isActive: boolean;
}

export function ZoneRow({ initial, hubs }: { initial: ZoneValues; hubs: { code: string; name: string }[] }) {
  const [v, setV] = useState(initial);
  const { pending, result, run } = useSave();
  const set = (p: Partial<ZoneValues>) => setV((x) => ({ ...x, ...p }));
  return (
    <tr className="border-b border-line align-middle" data-testid="zone-row" data-state={v.state}>
      <td className="p-2 font-semibold">{v.displayName}</td>
      <td className="p-1">
        <Input aria-label={`${v.state} delivery fee (₦)`} inputMode="decimal" value={v.fee} onChange={(e) => set({ fee: e.target.value })} className="w-24 py-1.5" />
      </td>
      <td className="p-1">
        <span className="flex items-center gap-1">
          <Input aria-label={`${v.state} min days`} type="number" min={0} value={String(v.etaMinDays)} onChange={(e) => set({ etaMinDays: Number(e.target.value) })} className="w-16 py-1.5" />–
          <Input aria-label={`${v.state} max days`} type="number" min={0} value={String(v.etaMaxDays)} onChange={(e) => set({ etaMaxDays: Number(e.target.value) })} className="w-16 py-1.5" />
        </span>
      </td>
      <td className="p-1">
        <select aria-label={`${v.state} hub`} value={v.hubCode} onChange={(e) => set({ hubCode: e.target.value })} className="rounded-lg border border-line bg-card px-2 py-2">
          {hubs.map((h) => (
            <option key={h.code} value={h.code}>
              {h.code}
            </option>
          ))}
        </select>
      </td>
      <td className="p-1 text-center">
        <input type="checkbox" aria-label={`${v.state} same-day`} checked={v.sameDayEnabled} onChange={(e) => set({ sameDayEnabled: e.target.checked })} className="size-5 accent-navy" />
      </td>
      <td className="p-1 text-center">
        <input type="checkbox" aria-label={`${v.state} active`} checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="size-5 accent-navy" />
      </td>
      <td className="p-1">
        <Button size="sm" disabled={pending} onClick={() => run(() => saveZoneAction(v))}>
          Save
        </Button>
        <Msg result={result} />
      </td>
    </tr>
  );
}

export interface CategoryValues {
  id?: string | null;
  name: string;
  slug: string;
  emoji: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export function CategoryForm({ initial }: { initial: CategoryValues }) {
  const [v, setV] = useState(initial);
  const { pending, result, run } = useSave();
  const set = (p: Partial<CategoryValues>) => setV((x) => ({ ...x, ...p }));
  return (
    <form
      className="grid grid-cols-2 gap-2 rounded-lg border border-line p-3 sm:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveCategoryAction(v), () => !initial.id && setV(initial));
      }}
    >
      <Field label="Name">{({ id }) => <Input id={id} value={v.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
      <Field label="Slug" hint={initial.id ? undefined : "Auto from name"}>{({ id }) => <Input id={id} value={v.slug} onChange={(e) => set({ slug: e.target.value })} />}</Field>
      <Field label="Emoji">{({ id }) => <Input id={id} value={v.emoji} onChange={(e) => set({ emoji: e.target.value })} />}</Field>
      <Field label="Icon">{({ id }) => <Input id={id} value={v.icon} onChange={(e) => set({ icon: e.target.value })} />}</Field>
      <Field label="Order">{({ id }) => <Input id={id} type="number" value={String(v.sortOrder)} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />}</Field>
      <div className="flex flex-col justify-end">{check("Visible", v.isActive, (b) => set({ isActive: b }))}</div>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-6">
        <Button type="submit" size="sm" disabled={pending}>
          {initial.id ? "Save" : "Add category"}
        </Button>
        <Msg result={result} />
      </div>
    </form>
  );
}

export function ReviewActions({ id, status }: { id: string; status: string }) {
  const { pending, result, run } = useSave();
  return (
    <span className="flex flex-wrap items-center gap-2">
      {status !== "approved" ? (
        <Button size="sm" variant="whatsapp" disabled={pending} onClick={() => run(() => moderateReviewAction({ id, status: "approved" }))}>
          Approve
        </Button>
      ) : null}
      {status !== "rejected" ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => moderateReviewAction({ id, status: "rejected" }))}>
          Reject
        </Button>
      ) : null}
      <Msg result={result} />
    </span>
  );
}

export function MemberRow({ member, hubs }: { member: { id: string; role: string; isActive: boolean; hubCode: string | null }; hubs: { code: string; name: string }[] }) {
  const [v, setV] = useState(member);
  const { pending, result, run } = useSave();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <select aria-label="Role" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} className="rounded-lg border border-line bg-card px-2 py-2 text-label-md">
        {["admin", "staff", "dispatcher", "customer"].map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <select aria-label="Hub" value={v.hubCode ?? ""} onChange={(e) => setV({ ...v, hubCode: e.target.value || null })} className="rounded-lg border border-line bg-card px-2 py-2 text-label-md">
        <option value="">No hub</option>
        {hubs.map((h) => (
          <option key={h.code} value={h.code}>
            {h.code}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-label-md">
        <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="size-5 accent-navy" /> Active
      </label>
      <Button size="sm" disabled={pending} onClick={() => run(() => updateTeamMemberAction({ id: v.id, role: v.role as "admin", isActive: v.isActive, hubCode: v.hubCode }))}>
        Save
      </Button>
      <Msg result={result} />
    </span>
  );
}

export function NewMemberForm({ hubs }: { hubs: { code: string; name: string }[] }) {
  const empty = { fullName: "", email: "", phone: "", role: "staff" as "admin" | "staff" | "dispatcher", hubCode: "", password: "" };
  const [v, setV] = useState(empty);
  const { pending, result, run } = useSave();
  const err = (k: string) => (result && !result.ok ? result.fieldErrors?.[k] : undefined);
  return (
    <form
      className="grid grid-cols-1 gap-2 rounded-xl bg-card p-4 shadow-card sm:grid-cols-3"
      aria-label="Add a team member"
      data-testid="new-member"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createTeamMemberAction(v), () => setV(empty));
      }}
    >
      <Field label="Full name" error={err("fullName")}>{({ id }) => <Input id={id} value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} />}</Field>
      <Field label="Email" error={err("email")}>{({ id }) => <Input id={id} type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />}</Field>
      <Field label="Phone" error={err("phone")}>{({ id }) => <Input id={id} type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />}</Field>
      <Field label="Role">
        {({ id }) => (
          <Select id={id} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as typeof v.role })}>
            <option value="staff">Order staff</option>
            <option value="dispatcher">Dispatcher (rider)</option>
            <option value="admin">Admin</option>
          </Select>
        )}
      </Field>
      <Field label="Hub">
        {({ id }) => (
          <Select id={id} value={v.hubCode} onChange={(e) => setV({ ...v, hubCode: e.target.value })}>
            <option value="">No hub</option>
            {hubs.map((h) => (
              <option key={h.code} value={h.code}>
                {h.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Temporary password" hint="10+ characters; share it privately" error={err("password")}>
        {({ id, describedBy }) => <Input id={id} type="text" autoComplete="new-password" value={v.password} aria-describedby={describedBy} onChange={(e) => setV({ ...v, password: e.target.value })} />}
      </Field>
      <div className="flex items-center gap-2 sm:col-span-3">
        <Button type="submit" disabled={pending}>
          Create account
        </Button>
        <Msg result={result} />
      </div>
    </form>
  );
}
