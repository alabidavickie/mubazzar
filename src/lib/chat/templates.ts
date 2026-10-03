import { formatNaira, type Kobo } from "../money";
import { formatNgPhoneLocal } from "../phone";

/**
 * Chat message templates. Admin can override the template strings in settings
 * (`chat_templates`); placeholders are {curly_braces}. Unknown placeholders are left as-is.
 */
export const DEFAULT_TEMPLATES = {
  customer_order:
    "Hello MUBAZZAR, I just placed order {order_number}: {items} — {subtotal} + {delivery} to {state} = {total}. My name is {customer_name}. Please send payment details.",
  staff_greeting:
    "Hello {first_name}, this is MUBAZZAR 👋 Thank you for order {order_number}: {items}. Total: {total} (incl. {delivery} to {state}). I'll share our official payment details here. Please note: we will never ask for your card PIN or OTP.",
  staff_confirmation:
    "Hi {first_name}, please confirm your MUBAZZAR order {order_number}:\n{items}\nTotal: {total}\nDeliver to: {address}, {city}, {state}\nPhone: {phone}\nReply YES to confirm ✅",
  dispatch_contact:
    "Hello {first_name}, I'm your MUBAZZAR delivery rider for order {order_number}. I'm on my way to {address}, {city}. Please keep your phone close 📦",
} as const;

export type TemplateKey = keyof typeof DEFAULT_TEMPLATES;
export type TemplateSet = Partial<Record<TemplateKey, string>>;

export interface OrderMessageLine {
  name: string;
  /** Short bundle label, e.g. "2x Turbo Car Vacuum (His & Hers)" — already includes unit count. */
  bundleLabel?: string | null;
  packs: number;
  units: number;
  isFreeGift?: boolean;
}

export interface OrderMessageData {
  orderNumber: string;
  customerName: string;
  phoneE164?: string;
  state: string;
  city?: string;
  address?: string;
  lines: OrderMessageLine[];
  subtotalKobo: Kobo;
  deliveryFeeKobo: Kobo;
  totalKobo: Kobo;
}

export function describeLine(line: OrderMessageLine): string {
  if (line.bundleLabel) {
    return line.packs > 1 ? `${line.packs} × ${line.bundleLabel}` : line.bundleLabel;
  }
  return `${line.units}x ${line.name}`;
}

export function describeItems(lines: OrderMessageLine[], separator = ", "): string {
  return lines
    .filter((l) => !l.isFreeGift)
    .map(describeLine)
    .join(separator);
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function orderTemplateVars(data: OrderMessageData, itemSeparator = ", "): Record<string, string> {
  return {
    order_number: data.orderNumber,
    customer_name: data.customerName.trim(),
    first_name: firstName(data.customerName),
    items: describeItems(data.lines, itemSeparator),
    subtotal: formatNaira(data.subtotalKobo),
    delivery: data.deliveryFeeKobo === 0 ? "free delivery" : `${formatNaira(data.deliveryFeeKobo)} delivery`,
    delivery_fee: formatNaira(data.deliveryFeeKobo),
    state: data.state === "FCT" ? "Abuja (FCT)" : data.state,
    city: data.city ?? "",
    address: data.address ?? "",
    phone: data.phoneE164 ? formatNgPhoneLocal(data.phoneE164) : "",
    total: formatNaira(data.totalKobo),
  };
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : match,
  );
}

export function buildMessage(
  key: TemplateKey,
  data: OrderMessageData,
  overrides: TemplateSet | null | undefined = {},
): string {
  const template = overrides?.[key]?.trim() || DEFAULT_TEMPLATES[key];
  const separator = key === "staff_confirmation" ? "\n" : ", ";
  return renderTemplate(template, orderTemplateVars(data, separator));
}

/** The message the customer sends us after ordering (prefilled on wa.me, copied for other channels). */
export function buildCustomerOrderMessage(data: OrderMessageData, overrides?: TemplateSet | null): string {
  return buildMessage("customer_order", data, overrides);
}
