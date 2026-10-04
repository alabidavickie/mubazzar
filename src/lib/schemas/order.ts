import * as z from "zod/mini";
import { NG_STATES } from "../ng-states";
import { normalizeNgPhone } from "../phone";

/**
 * Shared order form schema — used by the landing page form, Quick Order sheet and checkout
 * on the client (React Hook Form) and re-validated on the server before create_order().
 * Written with `zod/mini` (tree-shakable) because it ships in the landing page's client bundle.
 */

const trimmed = (min: number, max: number, minMsg: string, maxMsg?: string) =>
  z.string({ error: minMsg }).check(z.trim(), z.minLength(min, minMsg), z.maxLength(max, maxMsg ?? "Too long"));

const optionalText = (max: number) => z.optional(z.string().check(z.trim(), z.maxLength(max, "Too long")));

const phoneField = z
  .string({ error: "Enter your WhatsApp number" })
  .check(
    z.trim(),
    z.minLength(1, "Enter your WhatsApp number"),
    z.refine((v) => normalizeNgPhone(v).ok, "Enter a valid Nigerian number, e.g. 0803 123 4567"),
  );

const optionalPhoneField = z.optional(
  z
    .string()
    .check(
      z.trim(),
      z.maxLength(20, "Too long"),
      z.refine((v) => !v || normalizeNgPhone(v).ok, "Enter a valid Nigerian number or leave it empty"),
    ),
);

export const chatChannelSchema = z.enum(["whatsapp", "instagram", "messenger", "telegram", "phone"]);

export const orderItemSchema = z.object({
  productId: z.uuid(),
  bundleId: z.optional(z.nullable(z.uuid())),
  packs: z.int().check(z.minimum(1), z.maximum(20)),
});

const attrText = (max: number) => z.optional(z.string().check(z.maxLength(max)));

export const attributionSchema = z.object({
  utm_source: attrText(200),
  utm_medium: attrText(200),
  utm_campaign: attrText(200),
  utm_content: attrText(200),
  utm_term: attrText(200),
  fbclid: attrText(500),
  fbc: attrText(500),
  fbp: attrText(200),
});

/** Customer-entered delivery fields (what the form renders). */
export const deliveryDetailsShape = {
  customerName: trimmed(2, 80, "Enter your full name", "Name is too long"),
  phone: phoneField,
  altPhone: optionalPhoneField,
  state: z.enum(NG_STATES, { error: "Choose your delivery state" }),
  city: trimmed(2, 80, "Enter your LGA or city"),
  address: trimmed(8, 300, "Enter your full delivery address (house number, street, area)", "Address is too long"),
  landmark: optionalText(120),
  chatChannel: z._default(chatChannelSchema, "whatsapp"),
  note: optionalText(500),
};

export const deliveryDetailsSchema = z.object(deliveryDetailsShape);

export const DELIVERY_FIELDS = Object.keys(deliveryDetailsShape) as (keyof typeof deliveryDetailsShape)[];

export const orderSubmissionSchema = z.extend(deliveryDetailsSchema, {
  items: z.array(orderItemSchema).check(z.minLength(1, "Your order is empty"), z.maxLength(20)),
  source: z.enum(["landing_page", "checkout", "quick_order"]),
  landingPageId: z.optional(z.nullable(z.uuid())),
  idempotencyKey: z.uuid(),
  attribution: z.optional(attributionSchema),
  eventId: z.optional(z.string().check(z.maxLength(100))),
  /** Honeypot: real users never fill this hidden field. */
  website: z.optional(z.string().check(z.maxLength(0))),
});

export type DeliveryDetailsInput = z.input<typeof deliveryDetailsSchema>;
export type DeliveryDetails = z.output<typeof deliveryDetailsSchema>;
export type OrderSubmissionInput = z.input<typeof orderSubmissionSchema>;
export type OrderSubmission = z.output<typeof orderSubmissionSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
