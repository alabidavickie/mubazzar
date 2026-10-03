# Test map

How every testing requirement in `docs/BRIEF.md` §8 is covered. Commands: `pnpm test` (unit + integration), `pnpm test:e2e` (Playwright: iphone-13, pixel-7, desktop), `pnpm lhci` (Lighthouse).

## Unit (Vitest, next to the code)
| Requirement | File |
|---|---|
| `formatNaira`, kobo math, discount % | `src/lib/money.test.ts` |
| Bundle pricing, flash-deal pricing | `src/lib/pricing.test.ts` |
| Delivery fee + same-day cut-off (Africa/Lagos) | `src/lib/delivery.test.ts` |
| Phone normalisation (`0803…`, `803…`, `+234803…`, invalid) | `src/lib/phone.test.ts` |
| Order number generator, duplicate-order detection | `src/lib/order-number.test.ts` |
| WhatsApp link builder (₦, emojis, newlines, special chars), chat templates, routing | `src/lib/chat/chat.test.ts` |
| Payment status from multiple partial payments | `src/lib/pricing.test.ts` |
| Shared order form schema (inline error copy, honeypot) | `src/lib/pricing.test.ts` |

## Integration (Vitest + in-memory Postgres via PGlite with all migrations + seed)
| Requirement | File |
|---|---|
| Order creation: stock reserved, totals correct, gift line, events logged | `tests/integration/orders.test.ts` |
| Concurrent orders on the last unit — no oversell | `tests/integration/orders.test.ts` |
| Price tampering ignored (server recomputes) | `tests/integration/orders.test.ts` |
| Status transitions + stock release/deduction | `tests/integration/orders.test.ts` |
| Unpaid auto-cancel releases stock | `tests/integration/orders.test.ts` |
| SQL payment-status logic mirrors TypeScript | `tests/integration/orders.test.ts` |
| Recording payments: partial → paid, overpayment flagged, audit log | `tests/integration/payments.test.ts` |
| `Purchase` fires once when paid/delivered | `tests/integration/payments.test.ts` |
| Customer / dispatcher / supplier recording a payment is rejected | `tests/integration/payments.test.ts`, `rls.test.ts` |
| RLS for every role (guest, customer, staff, dispatcher, supplier, admin) | `tests/integration/rls.test.ts` |

## E2E (Playwright, mobile viewports + desktop, axe-core on every customer page)
| Brief journey | Spec |
|---|---|
| 1. Ad visitor → LP → 2x bundle → order → thank-you WhatsApp link → admin shows awaiting_chat + UTM | `tests/e2e/lp-order.spec.ts` |
| 2. Instagram channel → copy order details → handle link; disabled channels hidden | `tests/e2e/channel-handoff.spec.ts` |
| 3. Staff partial + balance payment → paid, audit log; POD collected by dispatcher | `tests/e2e/admin-payments.spec.ts` |
| 4. Home → Flash deal → Quick Order sheet → order placed | `tests/e2e/home-quick-order.spec.ts` |
| 5. Catalog filters + sort in URL, back button, Load More | `tests/e2e/catalog.spec.ts` |
| 6. Search suggestions → PDP → cart → checkout | `tests/e2e/search-checkout.spec.ts` |
| 7. Track order with number + phone | `tests/e2e/track.spec.ts` |
| 8. Admin product + bundles → landing page → publish → live | `tests/e2e/admin-catalog-lp.spec.ts` |
| 9. Staff confirms + assigns → dispatcher delivers → stock deducted | `tests/e2e/dispatch.spec.ts` |
| 10. Supplier applies → approved → submits → approved → live | `tests/e2e/supplier.spec.ts` |
| 11. Form validation messages | `tests/e2e/form-validation.spec.ts` |
| 12. Countdown real time + ended state | `tests/e2e/countdown.spec.ts` |
| Auth & access control | `tests/e2e/auth.spec.ts` |
| Smoke, overflow, health | `tests/e2e/smoke.spec.ts` |
| Visual screenshots at 390px (Home, Catalog, Landing) → `tests/screenshots/` | `tests/e2e/visual.spec.ts` |
