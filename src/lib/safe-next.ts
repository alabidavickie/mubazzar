/**
 * Post-login redirect target: same-site paths only. Browsers drop tabs/newlines inside URLs
 * ("/\t/evil.com" becomes "//evil.com"), so control characters and backslashes are refused too.
 */
export function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || next.length > 500 || !next.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(next)) return null;
  try {
    const u = new URL(next, "https://mubazzar.invalid");
    return u.origin === "https://mubazzar.invalid" ? `${u.pathname}${u.search}${u.hash}` : null;
  } catch {
    return null;
  }
}
