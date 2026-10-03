import { describe, expect, it } from "vitest";
import {
  buildChannelLink,
  buildWhatsAppLink,
  enabledChannels,
  pickWhatsAppChannel,
  whatsAppDigits,
  type ChatChannel,
} from "./links";
import {
  buildCustomerOrderMessage,
  buildMessage,
  describeItems,
  renderTemplate,
  type OrderMessageData,
} from "./templates";

const order: OrderMessageData = {
  orderNumber: "MBZ-7K2QPA",
  customerName: "Babatunde Adeyemi",
  phoneE164: "+2348031234567",
  state: "Lagos",
  city: "Ikeja",
  address: "12 Allen Avenue",
  lines: [
    { name: "Turbo Car Vacuum", bundleLabel: "2x Turbo Car Vacuum (His & Hers)", packs: 1, units: 2 },
    { name: "Aromatherapy Car Diffuser", packs: 1, units: 1, isFreeGift: true },
  ],
  subtotalKobo: 3_500_000,
  deliveryFeeKobo: 250_000,
  totalKobo: 3_750_000,
};

// URLSearchParams.get() already percent-decodes — decoding again would corrupt literal "%" characters.
const decodeText = (href: string) => new URL(href).searchParams.get("text") ?? "";

describe("chat templates", () => {
  it("builds the brief's example customer message exactly", () => {
    expect(buildCustomerOrderMessage(order)).toBe(
      "Hello MUBAZZAR, I just placed order MBZ-7K2QPA: 2x Turbo Car Vacuum (His & Hers) — ₦35,000 + ₦2,500 delivery to Lagos = ₦37,500. My name is Babatunde Adeyemi. Please send payment details.",
    );
  });

  it("describes non-bundle lines with units and skips free gifts", () => {
    expect(
      describeItems([
        { name: "Solar Wall Light", packs: 2, units: 2 },
        { name: "Gift", packs: 1, units: 1, isFreeGift: true },
        { name: "Vacuum", bundleLabel: "3x Turbo Family Pack", packs: 2, units: 6 },
      ]),
    ).toBe("2x Solar Wall Light, 2 × 3x Turbo Family Pack");
  });

  it("says free delivery and expands FCT", () => {
    const msg = buildCustomerOrderMessage({ ...order, state: "FCT", deliveryFeeKobo: 0, totalKobo: 3_500_000 });
    expect(msg).toContain("₦35,000 + free delivery to Abuja (FCT) = ₦35,000");
  });

  it("uses admin overrides and leaves unknown placeholders intact", () => {
    expect(buildMessage("customer_order", order, { customer_order: "Order {order_number} {unknown} {total}" })).toBe(
      "Order MBZ-7K2QPA {unknown} ₦37,500",
    );
    expect(renderTemplate("{a}{b}", { a: "1" })).toBe("1{b}");
  });

  it("renders the staff confirmation with line breaks and address", () => {
    const msg = buildMessage("staff_confirmation", order);
    expect(msg).toContain("Hi Babatunde,");
    expect(msg).toContain("\n2x Turbo Car Vacuum (His & Hers)\n");
    expect(msg).toContain("Deliver to: 12 Allen Avenue, Ikeja, Lagos");
    expect(msg).toContain("Phone: 0803 123 4567");
  });

  it("staff greeting warns that MUBAZZAR never asks for PIN/OTP", () => {
    expect(buildMessage("staff_greeting", order)).toMatch(/never ask for your card PIN or OTP/);
  });
});

describe("WhatsApp link builder", () => {
  it("uses wa.me with international digits only", () => {
    expect(buildWhatsAppLink("+234 812 000 8899")).toBe("https://wa.me/2348120008899");
    expect(buildWhatsAppLink("08120008899")).toBe("https://wa.me/2348120008899");
    expect(whatsAppDigits("+44 7911 123456")).toBe("447911123456");
    expect(() => whatsAppDigits("12")).toThrow();
  });

  it("URL-encodes ₦, emojis, line breaks and special characters and round-trips exactly", () => {
    const text = "Hello 👋 MUBAZZAR!\nOrder #MBZ-7K2QPA: 2x Vacuum (His & Hers) — ₦35,000 + 50% off? \"yes\" = ₦37,500 'ok' /path?a=b";
    const href = buildWhatsAppLink("+2348120008899", text);
    expect(href.startsWith("https://wa.me/2348120008899?text=")).toBe(true);
    // No raw characters that would break or truncate the query string.
    expect(href.split("?text=")[1]).not.toMatch(/[\s#&"₦\n?=/]|\u{1F44B}/u);
    expect(href).toContain("%E2%82%A6"); // ₦
    expect(href).toContain("%F0%9F%91%8B"); // 👋
    expect(href).toContain("%0A"); // newline
    expect(href).toContain("%26"); // &
    expect(href).toContain("%23"); // #
    expect(decodeText(href)).toBe(text);
  });

  it("produces a link whose decoded text contains order number, bundle and exact total", () => {
    const href = buildWhatsAppLink("+2348120008899", buildCustomerOrderMessage(order));
    const text = decodeText(href);
    expect(text).toContain("MBZ-7K2QPA");
    expect(text).toContain("2x Turbo Car Vacuum (His & Hers)");
    expect(text).toContain("₦37,500");
  });
});

describe("other channel links", () => {
  it("builds ig.me, m.me, t.me and tel links from handles or URLs", () => {
    expect(buildChannelLink("instagram", "@mubazzar.ng")).toBe("https://ig.me/m/mubazzar.ng");
    expect(buildChannelLink("instagram", "https://instagram.com/mubazzar.ng/")).toBe("https://ig.me/m/mubazzar.ng");
    expect(buildChannelLink("messenger", "MubazzarNG")).toBe("https://m.me/MubazzarNG");
    expect(buildChannelLink("telegram", "@mubazzar")).toBe("https://t.me/mubazzar");
    expect(buildChannelLink("phone", "0812 000 8899")).toBe("tel:+2348120008899");
  });
});

describe("WhatsApp routing", () => {
  const channels: ChatChannel[] = [
    { id: "lag", kind: "whatsapp", label: "Lagos desk", handle: "+2348120008899", hubCode: "lagos", isEnabled: true, weight: 1, sortOrder: 1 },
    { id: "abj", kind: "whatsapp", label: "Abuja desk", handle: "+2348120008800", hubCode: "abuja", isEnabled: true, weight: 1, sortOrder: 2 },
    { id: "off", kind: "whatsapp", label: "Off", handle: "+2348120008801", isEnabled: false, sortOrder: 0 },
    { id: "ig", kind: "instagram", label: "IG", handle: "mubazzar", isEnabled: true, sortOrder: 3 },
    { id: "tg", kind: "telegram", label: "TG", handle: "mubazzar", isEnabled: false, sortOrder: 4 },
  ];

  it("routes by hub, falling back to the first enabled number", () => {
    expect(pickWhatsAppChannel(channels, { routing: "by_hub", hubCode: "abuja", seed: "x" })?.id).toBe("abj");
    expect(pickWhatsAppChannel(channels, { routing: "by_hub", hubCode: "warehouse", seed: "x" })?.id).toBe("lag");
  });

  it("round-robins deterministically and never picks disabled numbers", () => {
    const picks = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = pickWhatsAppChannel(channels, { routing: "round_robin", seed: `MBZ-${i}` });
      picks.add(c!.id);
      expect(pickWhatsAppChannel(channels, { routing: "round_robin", seed: `MBZ-${i}` })!.id).toBe(c!.id);
    }
    expect(picks).toEqual(new Set(["lag", "abj"]));
  });

  it("returns null when no WhatsApp number is enabled and hides disabled channels", () => {
    expect(pickWhatsAppChannel([channels[2]!], { routing: "first", seed: "x" })).toBeNull();
    expect(enabledChannels(channels).map((c) => c.id)).toEqual(["lag", "abj", "ig"]);
  });
});
