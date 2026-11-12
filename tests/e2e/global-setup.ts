import { request, type FullConfig } from "@playwright/test";

/**
 * Warms the image optimizer before any test runs.
 *
 * `next start` resizes an image on its first request. If the browser cancels that first request
 * (a test navigates away or closes the page while images are still loading), the server never
 * finishes it and every later request for the same image + width hangs forever. That made
 * crawl.spec time out on GitHub (2026-11-12: `/c/smart-gadgets`, `multi-cable.webp` at w=360),
 * reproduced locally with `curl -m 0.01` on a cold image. Vercel resizes images in its own
 * service, so the live site is not affected; this only keeps the test server honest.
 *
 * Here every resized image the public pages reference is fetched once, to completion, so no test
 * can be the one that cancels a cold request. A failure here is a real problem (a page or image
 * that does not load) and stops the run.
 */
const EXTRA_PAGES = ["/cart", "/search?q=vacuum", "/shop?page=2", "/shop?page=3"];
const ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";
const CONCURRENCY = 4;

async function inBatches<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) await fn(items[next++]!);
    }),
  );
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  const api = await request.newContext({ baseURL, timeout: 120_000 });
  try {
    const sitemap = await (await api.get("/sitemap.xml")).text();
    const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
      const u = new URL(m[1]!);
      return u.pathname + u.search;
    });

    const images = new Set<string>();
    await inBatches([...new Set([...pages, ...EXTRA_PAGES])], async (path) => {
      const res = await api.get(path);
      if (!res.ok()) return; // crawl.spec reports broken pages; this step only collects images
      const html = (await res.text()).replaceAll("&amp;", "&");
      // HTML attributes only: the same URLs also appear JSON-escaped (&) in the inline page data.
      for (const m of html.matchAll(/\/_next\/image\?url=[^"'\s<>\\]+/g)) if (/[?&]w=\d+/.test(m[0])) images.add(m[0]);
    });

    const failed: string[] = [];
    await inBatches([...images], async (src) => {
      const res = await api.get(src, { headers: { Accept: ACCEPT } });
      if (!res.ok()) failed.push(`${res.status()} ${src}`);
    });
    if (failed.length) throw new Error(`Images that do not load:\n${failed.slice(0, 20).join("\n")}`);
  } finally {
    await api.dispose();
  }
}
