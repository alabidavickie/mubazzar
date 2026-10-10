import type { AppRole } from "@/server/session";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  roles: AppRole[];
  group: "Sales" | "Catalogue" | "Content" | "Settings";
}

const STAFF: AppRole[] = ["admin", "staff"];
const ADMIN: AppRole[] = ["admin"];

/** Single source of truth for admin navigation (staff only see Sales). */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", roles: STAFF, group: "Sales" },
  { href: "/admin/orders", label: "Orders", icon: "receipt_long", roles: STAFF, group: "Sales" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics", roles: ADMIN, group: "Sales" },
  { href: "/admin/products", label: "Products", icon: "inventory_2", roles: ADMIN, group: "Catalogue" },
  { href: "/admin/inventory", label: "Inventory", icon: "inventory", roles: ADMIN, group: "Catalogue" },
  { href: "/admin/categories", label: "Categories", icon: "category", roles: ADMIN, group: "Catalogue" },
  { href: "/admin/flash-deals", label: "Flash deals", icon: "bolt", roles: ADMIN, group: "Catalogue" },
  { href: "/admin/landing-pages", label: "Landing pages", icon: "campaign", roles: ADMIN, group: "Content" },
  { href: "/admin/reviews", label: "Reviews", icon: "rate_review", roles: ADMIN, group: "Content" },
  { href: "/admin/homepage", label: "Homepage", icon: "storefront", roles: ADMIN, group: "Content" },
  { href: "/admin/delivery", label: "Delivery zones", icon: "local_shipping", roles: ADMIN, group: "Settings" },
  { href: "/admin/chat-payments", label: "Chat & payments", icon: "forum", roles: ADMIN, group: "Settings" },
  { href: "/admin/team", label: "Staff & riders", icon: "group", roles: ADMIN, group: "Settings" },
  { href: "/admin/audit", label: "Audit log", icon: "history", roles: ADMIN, group: "Settings" },
];

export function navFor(role: AppRole): AdminNavItem[] {
  return ADMIN_NAV.filter((i) => i.roles.includes(role));
}
