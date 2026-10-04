// Measures first-load JavaScript (gzipped) for pages of a running production server.
// Usage: node scripts/measure-js.mjs http://localhost:3100 /lp/car-vacuum / /shop
// Counts every <script src> in the HTML except `nomodule` legacy polyfills, gzipped at level 9.
import { gzipSync } from "node:zlib";

const [base = "http://localhost:3100", ...paths] = process.argv.slice(2);
const targets = paths.length ? paths : ["/lp/car-vacuum", "/", "/shop"];
const BUDGET_KB = 150;

let failed = false;
for (const p of targets) {
  const html = await (await fetch(base + p)).text();
  const srcs = [...html.matchAll(/<script([^>]*)\ssrc="([^"]+)"([^>]*)>/g)]
    .filter((m) => !/nomodule/i.test(m[1] + m[3]))
    .map((m) => m[2]);
  let total = 0;
  const rows = [];
  for (const src of [...new Set(srcs)]) {
    const body = Buffer.from(await (await fetch(new URL(src, base))).arrayBuffer());
    const gz = gzipSync(body, { level: 9 }).length;
    total += gz;
    rows.push([gz, src]);
  }
  rows.sort((a, b) => b[0] - a[0]);
  const kb = (total / 1024).toFixed(1);
  const over = p.startsWith("/lp/") && total / 1024 > BUDGET_KB;
  if (over) failed = true;
  console.log(`${p}: ${kb} KB gz across ${rows.length} scripts${p.startsWith("/lp/") ? ` (budget ${BUDGET_KB} KB${over ? " — OVER" : " — ok"})` : ""}`);
  for (const [gz, src] of rows.slice(0, 6)) console.log(`   ${(gz / 1024).toFixed(1).padStart(6)} KB  ${src}`);
}
process.exitCode = failed ? 1 : 0;
