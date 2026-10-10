/**
 * Where the "Back" control goes when there is no in-site history to return to
 * (deep link, new tab, bookmark). Returns null on pages that are a section's root.
 */
export interface BackTarget {
  href: string;
  /** Short destination name shown to screen readers ("Back to Products"). */
  label: string;
  /** Prefer `history.back()` when the visitor arrived from another page of this site. */
  preferHistory: boolean;
}

const SEGMENT_LABEL: Record<string, string> = {
  admin: "Admin",
  orders: "Orders",
  products: "Products",
  "landing-pages": "Landing pages",
  dispatch: "My deliveries",
  account: "Account",
  shop: "Shop",
};

export function backTarget(pathname: string): BackTarget | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/admin" || path === "/dispatch") return null;
  const parts = path.split("/").filter(Boolean);

  // Category and product (landing) pages sit under the catalogue.
  if (parts[0] === "c" || parts[0] === "lp") return { href: "/shop", label: "Back to Shop", preferHistory: true };
  // The thank-you page must not walk back into a submitted order form.
  if (parts[0] === "order") return { href: "/", label: "Back to Home", preferHistory: false };
  if (parts[0] === "dispatch") return { href: "/dispatch", label: "Back to My deliveries", preferHistory: true };

  if (parts[0] === "admin") {
    // /admin/orders/<id>/print → the order; /admin/orders/<id> → Orders; /admin/orders → Admin home.
    const parent = parts.length > 1 ? parts.slice(0, -1) : [];
    const href = parent.length ? `/${parent.join("/")}` : "/admin";
    const last = parent[parent.length - 1] ?? "admin";
    const label = parts[parts.length - 1] === "print" ? "Back to order" : `Back to ${SEGMENT_LABEL[last] ?? "Admin"}`;
    return { href, label, preferHistory: true };
  }

  if (parts.length > 1) {
    const parent = `/${parts[0]}`;
    return { href: parent, label: `Back to ${SEGMENT_LABEL[parts[0]!] ?? "previous page"}`, preferHistory: true };
  }
  return { href: "/", label: "Back to Home", preferHistory: true };
}
