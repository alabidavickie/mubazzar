"use server";

import { headers } from "next/headers";
import { placeOrder, type PlaceOrderResult } from "@/server/services/orders";
import { getSession } from "@/server/session";
import type { OrderSubmissionInput } from "@/lib/schemas/order";

export async function submitOrderAction(input: OrderSubmissionInput): Promise<PlaceOrderResult> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const session = await getSession();
  return placeOrder(input, {
    ip,
    userAgent: h.get("user-agent"),
    userId: session?.role === "customer" ? session.userId : null,
    url: h.get("referer"),
  });
}
