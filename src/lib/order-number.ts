/**
 * Human-friendly order numbers: "MBZ-" + 6 characters from an alphabet without
 * look-alikes (no 0/O, 1/I/L) so customers can read them out on WhatsApp calls.
 */
export const ORDER_NUMBER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const ORDER_NUMBER_PATTERN = /^MBZ-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export type RandomInt = (maxExclusive: number) => number;

const cryptoRandomInt: RandomInt = (max) => {
  // Rejection sampling over a Uint32 to avoid modulo bias.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    const v = buf[0]!;
    if (v < limit) return v % max;
  }
};

export function generateOrderNumber(randomInt: RandomInt = cryptoRandomInt): string {
  let out = "MBZ-";
  for (let i = 0; i < 6; i++) {
    out += ORDER_NUMBER_ALPHABET[randomInt(ORDER_NUMBER_ALPHABET.length)];
  }
  return out;
}

/** Normalises user input like "mbz 7k2qpa" → "MBZ-7K2QPA"; null if it can't be an order number. */
export function normalizeOrderNumber(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = cleaned.startsWith("MBZ") ? cleaned.slice(3) : cleaned;
  const candidate = `MBZ-${body}`;
  return ORDER_NUMBER_PATTERN.test(candidate) ? candidate : null;
}
