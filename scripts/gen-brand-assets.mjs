// Generates brand assets from design/logo.png and product images:
//  - src/app/icon.png, src/app/apple-icon.png, public/brand/* (PWA icons, emblem)
//  - src/app/opengraph-image.png + twitter-image.png (1200×630)
//  - public/images/products/*.webp from .data/design-photos (see fetch-design-photos.mjs)
//  - branded placeholders for catalogue items without a photo (ph-<slug>.webp)
// Usage: node scripts/gen-brand-assets.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const logo = path.join(root, "design", "logo.png");
const brandDir = path.join(root, "public", "brand");
const productsDir = path.join(root, "public", "images", "products");
mkdirSync(brandDir, { recursive: true });
mkdirSync(productsDir, { recursive: true });

const IVORY = "#FBF9F5";
const NAVY = "#0E294B";
const NAVY_DEEP = "#00142F";
const GOLD = "#D4AF37";
const GOLD_SOFT = "#FED65B";

// ── Emblem crop (the "MB" mark sits in the middle of the 1408×768 artwork) ──
const emblem = await sharp(logo).extract({ left: 495, top: 115, width: 420, height: 420 }).toBuffer();
const rounded = (size, radius) =>
  Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></svg>`);

async function icon(size, file, { round = true } = {}) {
  let img = sharp(emblem).resize(size, size, { kernel: "lanczos3" });
  if (round) img = img.composite([{ input: rounded(size, Math.round(size * 0.22)), blend: "dest-in" }]);
  await img.png({ compressionLevel: 9, palette: size <= 192, quality: 90 }).toFile(file);
}
await icon(64, path.join(root, "src", "app", "icon.png"));
await icon(180, path.join(root, "src", "app", "apple-icon.png"), { round: false });
await icon(192, path.join(brandDir, "icon-192.png"), { round: false });
await icon(512, path.join(brandDir, "icon-512.png"), { round: false });
await sharp(emblem).resize(160, 160).webp({ quality: 85 }).toFile(path.join(brandDir, "emblem.webp"));

// ── Open Graph / Twitter card ──
const ogLogo = await sharp(logo).resize({ width: 1100, height: 600, fit: "contain", background: IVORY }).toBuffer();
const og = sharp({ create: { width: 1200, height: 630, channels: 3, background: IVORY } }).composite([
  { input: ogLogo, gravity: "center" },
  {
    input: Buffer.from(
      `<svg width="1200" height="630"><rect x="0" y="606" width="1200" height="24" fill="${NAVY}"/><rect x="0" y="600" width="1200" height="6" fill="${GOLD}"/></svg>`,
    ),
    top: 0,
    left: 0,
  },
]);
await og.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(root, "src", "app", "opengraph-image.jpg"));
await og.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(root, "src", "app", "twitter-image.jpg"));

// ── Design photos → WebP ──
const photosDir = path.join(root, ".data", "design-photos");
const converted = new Set();
if (existsSync(photosDir)) {
  for (const f of readdirSync(photosDir)) {
    const name = f.replace(/\.img$/, "");
    const width = name === "car-vacuum-hero" || name === "vacuum-demo" ? 1200 : 900;
    try {
      await sharp(path.join(photosDir, f)).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(productsDir, `${name}.webp`));
      converted.add(name);
    } catch (e) {
      console.warn(`Could not convert ${f}: ${e.message}`);
    }
  }
}

// ── Placeholders (any referenced image without a photo) ──
const iconPaths = readFileSync(path.join(root, "src", "components", "icons", "paths.ts"), "utf8");
const pathFor = (name) => new RegExp(`"${name}": "([^"]+)"`).exec(iconPaths)?.[1] ?? "";
const CATEGORY_ICON = {
  "car-tech": "directions_car",
  kitchen: "skillet",
  "solar-power": "solar_power",
  "smart-gadgets": "devices",
  "home-tech": "home",
  security: "shield",
  "problem-solvers": "build",
};
const catalog = readFileSync(path.join(root, "src", "server", "db", "seed", "catalog.ts"), "utf8");
const wanted = new Map(); // file → {name, category}
for (const block of catalog.split(/\n\s*\{\s*\n?\s*slug: /).slice(1)) {
  const name = /name: "([^"]+)"/.exec(block)?.[1];
  const category = /category: "([^"]+)"/.exec(block)?.[1];
  for (const m of block.matchAll(/\b(img|ph)\("([^"]+)"/g)) {
    const file = m[1] === "ph" ? `ph-${m[2]}.webp` : m[2];
    if (!wanted.has(file)) wanted.set(file, { name, category });
  }
  const giftImage = /image: "([^"]+\.webp)"/.exec(block)?.[1];
  if (giftImage && !wanted.has(giftImage)) wanted.set(giftImage, { name: "Free gift", category });
}
wanted.set("vacuum-demo.webp", { name: "Product demo", category: "car-tech" });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function wrap(text, max = 22) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) {
      lines.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.slice(0, 3);
}

let placeholders = 0;
for (const [file, meta] of wanted) {
  const base = file.replace(/\.webp$/, "");
  if (converted.has(base) || existsSync(path.join(productsDir, file))) continue;
  const d = pathFor(CATEGORY_ICON[meta.category] ?? "storefront");
  const lines = wrap(meta.name ?? "MUBAZZAR");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NAVY_DEEP}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient></defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <circle cx="660" cy="680" r="220" fill="${GOLD_SOFT}" opacity="0.08"/>
  <circle cx="400" cy="300" r="132" fill="${GOLD_SOFT}" opacity="0.14"/>
  <circle cx="400" cy="300" r="104" fill="${GOLD}"/>
  <svg x="330" y="230" width="140" height="140" viewBox="0 -960 960 960"><path d="${d}" fill="${NAVY_DEEP}"/></svg>
  ${lines
    .map(
      (l, i) =>
        `<text x="400" y="${520 + i * 52}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="42" fill="#FFFFFF">${esc(l)}</text>`,
    )
    .join("\n  ")}
  <text x="400" y="740" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="26" letter-spacing="6" fill="${GOLD}">MUBAZZAR</text>
</svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(path.join(productsDir, file));
  placeholders++;
}

console.log(`Brand icons + OG written. Photos: ${converted.size}. Placeholders: ${placeholders}.`);
