import { z } from "zod";
import { NG_STATES } from "../ng-states";
import { normalizeNgPhone } from "../phone";

/**
 * Shared order form schema — used by the landing page form, Quick Order sheet and checkout
 * on the client (React Hook Form) and re-validated on the server before create_order().
 */

const phoneField = z
  .string({ error: "Enter your WhatsApp number" })
  .trim()
  .min(1, "Enter your WhatsApp number")
  .refine((v) => normalizeNgPhone(v).ok, "Enter a valid Nigerian number, e.g. 0803 123 4567");

const optionalPhoneField = z
  .string()
  .trim()
  .max(20)
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || normalizeNgPhone(v).ok, "Enter a valid Nigerian number or leave it empty");

export const chatChannelSchema = z.enum(["whatsapp", "instagram", "messenger", "telegram", "phone"]);

export const orderItemSchema = z.object({
  productId: z.uuid(),
  bundleId: z.uuid().nullable().optional(),
  packs: z.number().int().min(1).max(20),
});

export const attributionSchema = z
  .object({
    utm_source: z.string().max(200).optional(),
    utm_medium: z.string().max(200).optional(),
    utm_campaign: z.string().max(200).optional(),
    utm_content: z.string().max(200).optional(),
    utm_term: z.string().max(200).optional(),
    fbclid: z.string().max(500).optional(),
    fbc: z.string().max(500).optional(),
    fbp: z.string().max(200).optional(),
  })
  .partial();

/** Customer-entered delivery fields (what the form renders). */
export const deliveryDetailsSchema = z.object({
  customerName: z
    .string({ error: "Enter your full name" })
    .trim()
    .min(2, "Enter your full name")
    .max(80, "Name is too long"),
  phone: phoneField,
  altPhone: optionalPhoneField,
  state: z.enum(NG_STATES, { error: "Choose your delivery state" }),
  city: z.string({ error: "Enter your LGA or city" }).trim().min(2, "Enter your LGA or city").max(80),
  address: z
    .string({ error: "Enter your delivery address" })
    .trim()
    .min(8, "Enter your full delivery address (house number, street, area)")
    .max(300, "Address is too long"),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  chatChannel: chatChannelSchema.default("whatsapp"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const orderSubmissionSchema = deliveryDetailsSchema.extend({
  items: z.array(orderItemSchema).min(1, "Your order is empty").max(20),
  source: z.enum(["landing_page", "checkout", "quick_order"]),
  landingPageId: z.uuid().nullable().optional(),
  idempotencyKey: z.uuid(),
  attribution: attributionSchema.optional(),
  eventId: z.string().max(100).optional(),
  /** Honeypot: real users never fill this hidden field. */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type DeliveryDetailsInput = z.input<typeof deliveryDetailsSchema>;
export type DeliveryDetails = z.output<typeof deliveryDetailsSchema>;
export type OrderSubmissionInput = z.input<typeof orderSubmissionSchema>;
export type OrderSubmission = z.output<typeof orderSubmissionSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
