/**
 * Nigerian mobile number normalisation to E.164 (+234XXXXXXXXXX).
 * Valid mobile prefixes after the country code: 70x, 71x, 80x, 81x, 90x, 91x (10 national digits).
 */

const NG_MOBILE_NATIONAL = /^[789][01]\d{8}$/;

export type PhoneResult = { ok: true; e164: string } | { ok: false; error: string };

export function normalizeNgPhone(input: string | null | undefined): PhoneResult {
  if (!input || !input.trim()) return { ok: false, error: "Enter your phone number" };
  // Keep a leading + then digits only. Accept spaces, dashes, dots and brackets.
  const trimmed = input.trim();
  if (/[^\d+\s\-().]/.test(trimmed)) {
    return { ok: false, error: "Phone number can only contain digits" };
  }
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.indexOf("+") > 0) return { ok: false, error: "Enter a valid Nigerian phone number" };
  digits = digits.replace(/^\+/, "");

  let national: string;
  if (digits.startsWith("234")) {
    national = digits.slice(3);
    if (national.startsWith("0")) national = national.slice(1); // +234 0803... typed by mistake
  } else if (digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    national = digits;
  }

  if (!NG_MOBILE_NATIONAL.test(national)) {
    return { ok: false, error: "Enter a valid Nigerian mobile number, e.g. 0803 123 4567" };
  }
  return { ok: true, e164: `+234${national}` };
}

export function isValidNgPhone(input: string | null | undefined): boolean {
  return normalizeNgPhone(input).ok;
}

/** "+2348031234567" → "0803 123 4567" */
export function formatNgPhoneLocal(e164: string): string {
  const national = e164.replace(/^\+234/, "");
  if (national.length !== 10) return e164;
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

/** "+2348031234567" → "+234 803 123 4567" */
export function formatNgPhoneIntl(e164: string): string {
  const national = e164.replace(/^\+234/, "");
  if (national.length !== 10) return e164;
  return `+234 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

/** wa.me requires digits only, international format without "+" or leading zeros. */
export function toWaDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}
