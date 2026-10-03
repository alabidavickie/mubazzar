/**
 * Money helpers. Every amount in MUBAZZAR is an integer number of kobo (₦1 = 100 kobo).
 * Floats never touch money: conversions from user input go through string parsing.
 */

export type Kobo = number;

export const KOBO_PER_NAIRA = 100;

function assertKobo(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of kobo, received ${value}`);
  }
}

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const nairaFormatterWithKobo = new Intl.NumberFormat("en-NG", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export interface FormatNairaOptions {
  /** Show kobo (e.g. ₦19,500.50). Defaults to showing kobo only when the amount is not whole naira. */
  kobo?: "auto" | "always" | "never";
  /** Compact form for chips: ₦15k, ₦1.2m */
  compact?: boolean;
}

/**
 * The single display formatter for money: 1950000 → "₦19,500".
 * Negative amounts render as "-₦500".
 */
export function formatNaira(kobo: Kobo, options: FormatNairaOptions = {}): string {
  assertKobo(kobo);
  const { kobo: koboMode = "auto", compact = false } = options;
  const negative = kobo < 0;
  const abs = Math.abs(kobo);
  const wholeNaira = Math.trunc(abs / KOBO_PER_NAIRA);
  const remainder = abs % KOBO_PER_NAIRA;
  let body: string;

  if (compact) {
    body = compactNaira(wholeNaira);
  } else if (koboMode === "always" || (koboMode === "auto" && remainder !== 0)) {
    // Build "19500.50" from integers to avoid float drift, then format.
    const fixed = `${wholeNaira}.${String(remainder).padStart(2, "0")}`;
    body = nairaFormatterWithKobo.format(Number(fixed));
  } else {
    body = nairaFormatter.format(wholeNaira);
  }
  return `${negative ? "-" : ""}₦${body}`;
}

function compactNaira(naira: number): string {
  if (naira >= 1_000_000) {
    const m = Math.round(naira / 100_000) / 10;
    return `${trimZero(m)}m`;
  }
  if (naira >= 1_000) {
    const k = Math.round(naira / 100) / 10;
    return `${trimZero(k)}k`;
  }
  return String(naira);
}

function trimZero(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Whole naira → kobo. Accepts integers only (use parseNairaInput for user strings). */
export function nairaToKobo(naira: number): Kobo {
  if (!Number.isSafeInteger(naira)) {
    throw new TypeError(`nairaToKobo expects whole naira, received ${naira}`);
  }
  return naira * KOBO_PER_NAIRA;
}

/**
 * Parses user/admin input like "19,500", "₦19,500.50", "19500" into kobo.
 * Returns null for anything that is not a non-negative amount with at most 2 decimals.
 */
export function parseNairaInput(input: string | number | null | undefined): Kobo | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim().replace(/[₦,\s]/g, "").replace(/^NGN/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  const kobo = Number(whole) * KOBO_PER_NAIRA + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(kobo) ? kobo : null;
}

/** Kobo → plain naira string for form inputs ("19500" or "19500.50"). */
export function koboToNairaInput(kobo: Kobo): string {
  assertKobo(kobo);
  const whole = Math.trunc(kobo / KOBO_PER_NAIRA);
  const rem = Math.abs(kobo % KOBO_PER_NAIRA);
  return rem === 0 ? String(whole) : `${whole}.${String(rem).padStart(2, "0")}`;
}

export function addKobo(...amounts: Kobo[]): Kobo {
  return amounts.reduce((sum, a) => {
    assertKobo(a);
    return sum + a;
  }, 0);
}

export function multiplyKobo(unit: Kobo, quantity: number): Kobo {
  assertKobo(unit, "unit");
  if (!Number.isSafeInteger(quantity)) throw new TypeError("quantity must be an integer");
  return unit * quantity;
}

/** Savings in kobo between compare-at and price (0 when there is no real discount). */
export function savingsKobo(price: Kobo, compareAt: Kobo | null | undefined): Kobo {
  assertKobo(price);
  if (compareAt === null || compareAt === undefined) return 0;
  assertKobo(compareAt);
  return Math.max(compareAt - price, 0);
}

/**
 * Whole-percent discount, rounded to the nearest integer (19,500 vs 38,000 → 49).
 * Returns 0 when there is no compare-at price or it is not higher than the price.
 */
export function discountPercent(price: Kobo, compareAt: Kobo | null | undefined): number {
  const saved = savingsKobo(price, compareAt);
  if (!saved || !compareAt) return 0;
  return Math.round((saved * 100) / compareAt);
}
