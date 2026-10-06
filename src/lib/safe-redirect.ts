/**
 * Returns `next` only when it is a same-site relative path; otherwise null.
 * Rejects protocol-relative URLs ("//evil"), backslash tricks ("/\\evil"), control characters
 * ("/\t/evil" — browsers strip tabs/newlines, turning it into "//evil"), and anything whose
 * resolved origin differs from ours.
 */
export function safeRedirectPath(next: unknown): string | null {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return null;
  try {
    const base = "https://mubazzar.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
