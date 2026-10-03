// Downloads the product photos referenced by the /design mocks into .data/design-photos/
// (raw files), keyed by our product image names. Run once; gen-brand-assets converts them to WebP.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, ".data", "design-photos");
mkdirSync(outDir, { recursive: true });

// data-alt keyword → target file name (without extension)
const MAP = [
  ["suctioning sand and biscuits", "car-vacuum-hero"],
  ["picking crumbs and fine red sand", "car-vacuum-1"],
  ["Reverse blow nozzle", "car-vacuum-2"],
  ["inflating an outdoor swimming float", "car-vacuum-3"],
  ["HEPA double air filter", "car-vacuum-4"],
  ["unboxing package layout", "car-vacuum-5"],
  ["aromatherapy car air freshener diffuser", "gift-diffuser"],
  ["demonstrating cordless handheld vacuum", "vacuum-demo"],
  ["solar wall security light", "solar-wall-light"],
  ["anti-snore", "anti-snore"],
  ["vegetable chopper", "veggie-chopper"],
  ["solar power bank", "solar-powerbank"],
  ["retractable car charger", "car-charger"],
  ["mosquito repeller", "pest-repeller"],
  ["thermal bluetooth mobile printer", "thermal-printer"],
  ["braided multi charging cable", "multi-cable"],
  ["water dispenser pump", "water-pump"],
  ["door alarm sensor", "door-alarm"],
];

const html = ["mubazzar_home.html", "mubazzar_shop_catalog.html", "mubazzar_ad_product_landing_page.html"]
  .map((f) => readFileSync(path.join(root, "design", f), "utf8"))
  .join("\n");

const imgs = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
const jobs = [];
for (const [keyword, name] of MAP) {
  const tag = imgs.find((t) => t.toLowerCase().includes(keyword.toLowerCase()));
  const src = tag && /src="(https:\/\/lh3\.googleusercontent\.com\/[^"]+)"/.exec(tag)?.[1];
  if (!src) {
    console.warn(`No design image for ${name}`);
    continue;
  }
  jobs.push({ name, src });
}

let ok = 0;
await Promise.all(
  jobs.map(async ({ name, src }) => {
    const file = path.join(outDir, `${name}.img`);
    if (existsSync(file)) return void ok++;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${src}=w1000`, { signal: AbortSignal.timeout(180_000) });
        if (!res.ok) throw new Error(String(res.status));
        writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        ok++;
        return;
      } catch (e) {
        if (attempt === 2) console.warn(`Failed ${name}: ${e}`);
      }
    }
  }),
);
console.log(`Fetched ${ok}/${jobs.length} design photos into ${outDir}`);
