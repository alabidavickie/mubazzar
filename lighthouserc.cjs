// Lighthouse CI — mobile (default Moto G Power emulation + simulated slow 4G throttling).
// Run: pnpm build && pnpm lhci   (reports are written to reports/lighthouse)
const port = process.env.LHCI_PORT || "3200";
const base = `http://localhost:${port}`;

module.exports = {
  ci: {
    collect: {
      startServerCommand: `node scripts/e2e-server.mjs ${port}`,
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 300000,
      url: [`${base}/`, `${base}/shop`, `${base}/lp/car-vacuum`],
      numberOfRuns: 3,
      chromePath: process.env.CHROME_PATH || undefined,
      settings: {
        // Mobile is the default form factor; keep the default simulated throttling (slow 4G).
        chromeFlags: "--headless=new --no-sandbox",
        skipAudits: ["uses-http2"], // local http server; production is served over HTTP/2 by Vercel
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      },
    },
    upload: { target: "filesystem", outputDir: "reports/lighthouse" },
  },
};
