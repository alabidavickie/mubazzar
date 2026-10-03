import "server-only";
import { asService } from "../db";
import { env, services } from "../env";

export type NotifyChannel = "sms" | "email" | "whatsapp";

export interface Notification {
  channel: NotifyChannel;
  to: string;
  template: string;
  subject?: string;
  body: string;
  orderId?: string | null;
}

interface Provider {
  send(n: Notification): Promise<{ providerRef?: string }>;
}

/** Termii is the most common Nigerian SMS gateway (DND-friendly "dnd" channel for transactional SMS). */
const termii: Provider = {
  async send(n) {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: env.termiiApiKey,
        to: n.to.replace("+", ""),
        from: env.termiiSenderId,
        sms: n.body,
        type: "plain",
        channel: "dnd",
      }),
    });
    if (!res.ok) throw new Error(`Termii ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { message_id?: string };
    return { providerRef: json.message_id };
  },
};

const resend: Provider = {
  async send(n) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.resendApiKey}` },
      body: JSON.stringify({ from: env.emailFrom, to: [n.to], subject: n.subject ?? "MUBAZZAR", text: n.body }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { id?: string };
    return { providerRef: json.id };
  },
};

/** WhatsApp Cloud API text message (only valid inside the 24h customer-service window). */
const whatsappCloud: Provider = {
  async send(n) {
    const res = await fetch(`https://graph.facebook.com/v21.0/${env.waCloudPhoneId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.waCloudToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: n.to.replace("+", ""),
        type: "text",
        text: { body: n.body },
      }),
    });
    if (!res.ok) throw new Error(`WhatsApp Cloud ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { messages?: { id: string }[] };
    return { providerRef: json.messages?.[0]?.id };
  },
};

function providerFor(channel: NotifyChannel): Provider | null {
  if (channel === "sms" && services.sms) return termii;
  if (channel === "email" && services.email) return resend;
  if (channel === "whatsapp" && services.whatsappCloud) return whatsappCloud;
  return null;
}

/**
 * Sends (or, without keys, mocks) a notification. Every notification is recorded in
 * notifications_outbox so tests and admins can see exactly what went out. Never throws.
 */
export async function notify(n: Notification): Promise<{ status: "sent" | "mocked" | "failed" }> {
  const provider = providerFor(n.channel);
  let status: "sent" | "mocked" | "failed" = "mocked";
  let providerRef: string | undefined;
  let error: string | undefined;
  if (provider) {
    try {
      providerRef = (await provider.send(n)).providerRef;
      status = "sent";
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message.slice(0, 500) : String(e);
    }
  } else if (env.nodeEnv !== "test") {
    console.info(`[notify:mock] ${n.channel} → ${n.to}: ${n.body.slice(0, 160)}`);
  }
  try {
    await asService((q) =>
      q.query(
        `insert into public.notifications_outbox (channel, recipient, template, subject, body, order_id, status, provider_ref, error, sent_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, case when $7 = 'sent' then now() end)`,
        [n.channel, n.to, n.template, n.subject ?? null, n.body, n.orderId ?? null, status, providerRef ?? null, error ?? null],
      ),
    );
  } catch (e) {
    console.error("[notify] failed to record outbox row", e);
  }
  return { status };
}
