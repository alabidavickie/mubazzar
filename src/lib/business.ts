/** Business/compliance display helpers (pure). */

const CAC_PATTERN = /^(RC|BN)\s?\d+$/;

/**
 * CAC registration number to display, or null. Only a real RC/BN number is ever shown — placeholders
 * such as "RC — to be provided" would be a false compliance claim.
 */
export function displayCac(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().replace(/\s+/g, " ");
  return CAC_PATTERN.test(v) ? v : null;
}
