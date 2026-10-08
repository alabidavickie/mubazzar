import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { login, loginCustomer } from "./helpers";

/**
 * Every server action is a public POST endpoint. This calls ALL of them (read from the build's action
 * manifest) as a guest and as each role, with EMPTY input so nothing is ever written, and checks the role
 * gate: admin-only actions bounce everyone but admins, order actions bounce everyone but staff, rider
 * actions bounce everyone but riders, and so on. A new action that isn't classified below fails this test,
 * so nobody can ship an ungated action by accident.
 */

type Role = "anon" | "customer" | "staff" | "dispatcher" | "supplier" | "admin";
const ROLES: Role[] = ["anon", "customer", "staff", "dispatcher", "supplier", "admin"];

/** requireRole() actions: who gets past the gate (everyone else is redirected to /login). */
const ADMIN: Role[] = ["admin"];
const STAFF: Role[] = ["admin", "staff"];
const REDIRECT_GATED: Record<string, Role[]> = {
  importProductsAction: ADMIN, saveProductAction: ADMIN, saveFlashDealAction: ADMIN, saveLandingAction: ADMIN,
  setLandingPublishedAction: ADMIN, saveSettingAction: ADMIN, saveCategoryAction: ADMIN, saveChannelAction: ADMIN,
  saveZoneAction: ADMIN, createTeamMemberAction: ADMIN, updateTeamMemberAction: ADMIN, moderateReviewAction: ADMIN,
  reviewSupplierAction: ADMIN, reviewSubmissionAction: ADMIN, uploadProductImageAction: ADMIN, uploadCatalogImageAction: ADMIN,
  adjustInventoryAction: ADMIN,
  addOrderNoteAction: STAFF, assignDispatcherAction: STAFF, recordPaymentAction: STAFF, setOrderStatusAction: STAFF,
  setPaymentFlagAction: STAFF,
  completeDeliveryAction: ["dispatcher"], failDeliveryAction: ["dispatcher"],
  saveSupplierProductAction: ["supplier"], uploadSupplierImageAction: ["supplier"],
};

/** Customer-only actions that answer a non-customer with a sign-in message instead of redirecting. */
const SOFT_GATED_CUSTOMER: Record<string, RegExp> = {
  saveAddressAction: /Please sign in again/, deleteAddressAction: /Please sign in again/, submitReviewAction: /Please sign in again/,
  toggleWishlistAction: /Sign in to save items/, syncCartAction: /"reason":"signed_out"/,
  getDefaultAddressAction: /\n1:null/, isWishlistedAction: /\n1:false/,
};

/** Meant for visitors (checkout, tracking, login, applying as a supplier…); they validate and rate-limit their own input. */
const PUBLIC = new Set([
  "applySupplierAction", "claimPaymentAction", "passwordLoginAction", "requestOtpAction", "verifyOtpAction",
  "submitOrderAction", "trackOrderAction", "logoutAction",
]);

const manifest: Record<string, { exportedName: string; workers: Record<string, unknown> }> = JSON.parse(
  readFileSync(path.join(process.cwd(), ".next/server/server-reference-manifest.json"), "utf8"),
).node;
const actions = Object.entries(manifest).map(([id, v]) => ({ id, name: v.exportedName, worker: Object.keys(v.workers)[0]! }));

/** The route whose bundle contains the action (Next only runs an action from a page that includes it). */
const pageUrl = (worker: string) =>
  "/" +
  worker
    .replace(/^app\//, "")
    .replace(/\/page$/, "")
    .split("/")
    .filter((s) => !/^\(.*\)$/.test(s))
    .map((s) => (s === "[id]" ? "00000000-0000-0000-0000-000000000000" : s === "[token]" ? "0".repeat(32) : s === "[slug]" ? "x" : s))
    .join("/");

let ipN = 0;
async function call(api: APIRequestContext, a: { id: string; worker: string }, headers: Record<string, string> = {}) {
  const res = await api.post(pageUrl(a.worker), {
    headers: { "Next-Action": a.id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", "x-forwarded-for": `10.88.${(ipN >> 8) & 255}.${ipN++ & 255}`, ...headers },
    data: "[]",
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  return { status: res.status(), redirected: Boolean(res.headers()["x-action-redirect"]), body: await res.text() };
}

test("every server action enforces its role gate", async ({ browser, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Permission matrix runs once (desktop)");
  test.setTimeout(240_000);

  // Nothing may be unclassified or stale.
  const known = new Set([...Object.keys(REDIRECT_GATED), ...Object.keys(SOFT_GATED_CUSTOMER), ...PUBLIC]);
  const names = new Set(actions.map((a) => a.name));
  expect([...names].filter((n) => !known.has(n)), "new server actions must be classified in action-permissions.spec.ts").toEqual([]);
  expect([...known].filter((n) => !names.has(n)), "classified actions that no longer exist").toEqual([]);

  const apis: Record<Role, APIRequestContext> = { anon: request } as Record<Role, APIRequestContext>;
  for (const role of ["staff", "dispatcher", "supplier", "admin"] as const) {
    const page = await (await browser.newContext({ ...testInfo.project.use })).newPage();
    await login(page, role);
    apis[role] = page.context().request;
  }
  const customerPage = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await loginCustomer(customerPage);
  apis.customer = customerPage.context().request;

  const wrong: string[] = [];
  for (const a of actions) {
    // Public actions are only classified above; calling logoutAction would end each role's session mid-test.
    if (PUBLIC.has(a.name)) continue;
    for (const role of ROLES) {
      const r = await call(apis[role], a);
      if (a.name in REDIRECT_GATED) {
        const allowed = REDIRECT_GATED[a.name]!.includes(role);
        if (r.redirected === allowed) wrong.push(`${a.name} as ${role}: ${allowed ? "was bounced" : "was NOT bounced"} (status ${r.status})`);
      } else if (a.name in SOFT_GATED_CUSTOMER) {
        const turnedAway = SOFT_GATED_CUSTOMER[a.name]!.test(r.body);
        if (role === "customer" && r.redirected) wrong.push(`${a.name} as customer: redirected`);
        // Read helpers answer null/false for everyone (empty input), so only the write actions can prove the customer gets through.
        if (role !== "customer" && !turnedAway) wrong.push(`${a.name} as ${role}: not turned away`);
        if (role === "customer" && turnedAway && !/getDefaultAddress|isWishlisted/.test(a.name)) wrong.push(`${a.name} as customer: turned away`);
      }
    }
  }
  expect(wrong).toEqual([]);

  // Cross-site request: even with a valid admin session cookie, a server action POST from another origin is refused.
  const settings = actions.find((a) => a.name === "saveSettingAction")!;
  const forged = await call(apis.admin, settings, { Origin: "https://evil.example" });
  expect(forged.redirected || forged.status >= 400, `cross-origin action call was accepted (status ${forged.status})`).toBe(true);
  expect(forged.body).not.toContain('"ok":true');

});
