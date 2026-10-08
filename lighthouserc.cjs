// Lighthouse CI — mobile (default Moto G Power emulation + simulated slow 4G throttling).
// Run: pnpm build && pnpm lhci   (reports are written to reports/lighthouse)
const port = process.env.LHCI_PORT || "3200";
const base = `http://localhost:${port}`;

const ASSERTIONS = {
  "categories:performance": ["error", { minScore: 0.9 }],
  "categories:accessibility": ["error", { minScore: 0.95 }],
  "categories:best-practices": ["error", { minScore: 0.95 }],
  "categories:seo": ["error", { minScore: 0.95 }],
  "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
  "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
};
const { "categories:seo": _seo, ...ASSERTIONS_NO_SEO } = ASSERTIONS;

module.exports = {
  ci: {
    collect: {
      startServerCommand: `node scripts/e2e-server.mjs ${port}`,
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 300000,
      // The pages ads and shoppers land on: home, catalog, the hand-built landing page, an automatic landing page
      // (built from the product alone) and a regular product page. LHCI_PATHS="/a,/b" / LHCI_RUNS=1 narrow a local run.
      url: (process.env.LHCI_PATHS ? process.env.LHCI_PATHS.split(",") : ["/", "/shop", "/lp/car-vacuum", "/lp/bladeless-neck-fan", "/p/bladeless-neck-fan"]).map((p) => `${base}${p}`),
      numberOfRuns: Number(process.env.LHCI_RUNS || 3),
      chromePath: process.env.CHROME_PATH || undefined,
      settings: {
        // Mobile form factor + slow-4G emulation applied in the browser (DevTools throttling: 562 ms RTT,
        // 1.6 Mbps, 4x CPU). Lantern's "simulate" mode ignores request priority, so the high-priority LCP
        // image competes with low-priority framework JS in its model (see DECISIONS.md for both numbers).
        throttlingMethod: "devtools",
        chromeFlags: "--headless=new --no-sandbox",
        skipAudits: ["uses-http2"], // local http server; production is served over HTTP/2 by Vercel
      },
    },
    assert: {
      // The automatic landing page (/lp/<product-without-a-custom-page>) is deliberately noindex — it repeats the product
      // page and exists for ads — so Lighthouse's "is crawlable" check would always fail its SEO score. Everything else
      // (speed, accessibility, best practices) is still enforced for it.
      assertMatrix: [
        { matchingUrlPattern: "^(?!.*/lp/bladeless-neck-fan).*$", assertions: ASSERTIONS },
        { matchingUrlPattern: "/lp/bladeless-neck-fan$", assertions: ASSERTIONS_NO_SEO },
      ],
    },
    upload: { target: "filesystem", outputDir: "reports/lighthouse" },
  },
};
