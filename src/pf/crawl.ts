// src/pf/crawl.ts
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

type CrawlEdge = {
  from: string;
  to: string;
  depth: number;
};

type CrawlRecord = {
  url: string;
  depth: number;
  discoveredFrom?: string;
};

function runId(): string {
  return `run-${Date.now()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.hash = "";
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return null;
  }
}

function isSkippableHref(href: string): boolean {
  const h = href.trim().toLowerCase();
  return (
    h.startsWith("mailto:") ||
    h.startsWith("tel:") ||
    h.startsWith("javascript:") ||
    h.startsWith("#")
  );
}

function isAssetUrl(u: URL): boolean {
  const p = u.pathname.toLowerCase();
  const exts = [
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
    ".pdf", ".zip", ".rar", ".7z",
    ".mp4", ".webm", ".mp3", ".wav",
    ".css", ".js", ".map",
    ".woff", ".woff2", ".ttf", ".otf",
  ];
  return exts.some((e) => p.endsWith(e));
}

function nextRunFiles(baseName: string, reportsDir: string) {
  if (!fs.existsSync(reportsDir)) {
    return {
      numbered: path.join(reportsDir, `${baseName}.crawl1.json`),
      latest: path.join(reportsDir, `${baseName}.crawl.latest.json`),
    };
  }

  const latest = path.join(reportsDir, `${baseName}.crawl.latest.json`);
  const files = fs.readdirSync(reportsDir, { withFileTypes: true }).map((f) => f.name);

  const re = new RegExp(`^${baseName}\\.crawl(\\d+)\\.json$`);
  let max = 0;
  for (const f of files) {
    const m = f.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }

  return {
    numbered: path.join(reportsDir, `${baseName}.crawl${max + 1}.json`),
    latest,
  };
}

async function extractLinks(pageUrl: string, hrefs: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const href of hrefs) {
    if (!href || isSkippableHref(href)) continue;
    try {
      const u = new URL(href, pageUrl);
      if (!u.protocol.startsWith("http")) continue;
      if (isAssetUrl(u)) continue;
      const norm = normalizeUrl(u.toString());
      if (norm) out.push(norm);
    } catch {
      // ignore bad hrefs
    }
  }
  return out;
}

/**
 * Pathfinder Web Crawler
 * 
 * Usage:
 *   npx ts-node src/pf/crawl.ts https://www.imdb.com/ --maxPages=50 --maxDepth=2 --sameHost=true
 *
 * Options:
 *   --maxPages=50    Maximum pages to discover (default: 50)
 *   --maxDepth=2     Maximum link depth to follow (default: 2)
 *   --sameHost=true  Only crawl same hostname (default: true)
 *
 * Example:
 *   npx ts-node src/pf/crawl.ts https://github.com --maxPages=20 --maxDepth=1
 */
(async () => {
  const seedArg = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
  const seedUrlRaw = seedArg || "https://www.imdb.com/";

  const maxPages =
    parseInt((process.argv.find((a) => a.startsWith("--maxPages=")) || "").split("=")[1] || "50", 10) || 50;

  const maxDepth =
    parseInt((process.argv.find((a) => a.startsWith("--maxDepth=")) || "").split("=")[1] || "2", 10) || 2;

  const sameHost =
    ((process.argv.find((a) => a.startsWith("--sameHost=")) || "").split("=")[1] || "true").toLowerCase() === "true";

  const seedNorm = normalizeUrl(seedUrlRaw);
  if (!seedNorm) {
    console.error("Invalid seed URL:", seedUrlRaw);
    process.exit(1);
  }

  const seedUrl = seedNorm;
  const seedHost = new URL(seedUrl).hostname.replace(/^www\./, "");
  const baseName = seedHost.split(".")[0];

  console.log(`Starting crawl: ${seedUrl}`);
  console.log(`Configuration: maxPages=${maxPages}, maxDepth=${maxDepth}, sameHost=${sameHost}`);

  const startedAt = nowIso();
  const id = runId();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
    viewport: { width: 1366, height: 900 },
  });

  context.setDefaultTimeout(60000);
  context.setDefaultNavigationTimeout(60000);

  const page = await context.newPage();

  const visited = new Set<string>();
  const discovered = new Set<string>();
  const records: CrawlRecord[] = [];
  const edges: CrawlEdge[] = [];

  const queue: Array<{ url: string; depth: number; from?: string }> = [{ url: seedUrl, depth: 0 }];

  discovered.add(seedUrl);
  records.push({ url: seedUrl, depth: 0 });

  while (queue.length > 0 && visited.size < maxPages) {
    const item = queue.shift()!;
    const current = item.url;
    const depth = item.depth;

    if (visited.has(current)) continue;
    visited.add(current);

    console.log(`[${visited.size}/${maxPages}] Crawling depth=${depth}: ${current}`);

    if (depth > maxDepth) continue;

    try {
      await page.goto(current, { waitUntil: "commit", timeout: 60000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(600);

      const hrefs = await page.$$eval("a[href]", (as) =>
        as.map((a) => (a as HTMLAnchorElement).getAttribute("href") || "").filter(Boolean)
      );

      const links = await extractLinks(current, hrefs);

      for (const link of links) {
        if (sameHost) {
          const h = new URL(link).hostname.replace(/^www\./, "");
          if (h !== seedHost) continue;
        }

        if (!discovered.has(link)) {
          discovered.add(link);
          records.push({ url: link, depth: depth + 1, discoveredFrom: current });
          queue.push({ url: link, depth: depth + 1, from: current });
        }

        edges.push({ from: current, to: link, depth: depth + 1 });

        if (discovered.size >= maxPages) break;
      }
    } catch (e: any) {
      console.log(`Error crawling ${current}: ${e?.message || "Unknown error"}`);
    }
  }

  await browser.close();

  const finishedAt = nowIso();

  const report = {
    tool: "Pathfinder",
    version: "1.2.0",
    runId: id,
    seedUrl,
    host: seedHost,
    sameHost,
    limits: { maxPages, maxDepth },
    startedAt,
    finishedAt,
    stats: {
      visited: visited.size,
      discovered: discovered.size,
      edges: edges.length,
    },
    discoveredUrls: Array.from(discovered),
    records,
    edges,
  };

  const reportsDir = path.resolve(process.cwd(), "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const out = nextRunFiles(baseName, reportsDir);
  fs.writeFileSync(out.numbered, JSON.stringify(report, null, 2), "utf-8");
  fs.writeFileSync(out.latest, JSON.stringify(report, null, 2), "utf-8");

  console.log("\nCrawl complete");
  console.log(`Discovered: ${report.stats.discovered} URLs`);
  console.log(`Visited: ${report.stats.visited} pages`);
  console.log(`Edges: ${report.stats.edges} links`);
  console.log(`\nSaved to: ${out.latest}`);
})();