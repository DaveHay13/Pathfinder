// src/pf/orchestrate.ts - Orchestrate Pathfinder analysis
import { scanPageLocators } from "./scan_locators";
import { scorePageScan } from "./score";
import { SiteLocatorReport, LocatorStrategy } from "./types";
import { runId, saveReport, extractHostBase, formatDuration } from "./utils";
import { logger } from "./logger";
import fs from "fs";
import path from "path";

/**
 * Find the most recent crawl file in reports directory
 */
function findLatestCrawl(reportsDir: string): string | null {
  if (!fs.existsSync(reportsDir)) {
    return null;
  }

  const files = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.crawl.latest.json'))
    .map(f => ({
      name: f,
      path: path.join(reportsDir, f),
      mtime: fs.statSync(path.join(reportsDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].path : null;
}

/**
 * Normalize URL to avoid duplicate scans
 * Strips query parameters and fragments
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Deduplicate URLs
 */
function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const url of urls) {
    const normalized = normalizeUrl(url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(url);
    }
  }

  return unique;
}

// ============================================================================
// UPDATED: Added waitAfter config for SPA support
// ============================================================================
export async function orchestrate(config: {
  crawlReportPath?: string;
  maxUrls?: number;
  delayMs?: number;
  waitAfter?: number;  // NEW: Wait time after page load for SPAs
  reportsDir: string;
}): Promise<SiteLocatorReport> {
  const startTime = Date.now();
  const reportsDir = config.reportsDir || path.resolve(process.cwd(), "reports");

  // Auto-detect crawl file if not provided
  let crawlPath: string | undefined = config.crawlReportPath;
  if (!crawlPath) {
    logger.info("No crawl file specified, searching for latest...");
    const found = findLatestCrawl(reportsDir);
    if (!found) {
      throw new Error(
        `No crawl file found in ${reportsDir}\n` +
        `Run: npx ts-node src/pf/crawl.ts <URL> --maxPages=10\n` +
        `Then: npx ts-node src/pf/orchestrate.ts`
      );
    }
    crawlPath = found;
    logger.info(`Found: ${path.basename(crawlPath)}\n`);
  }

  // Validate crawl file exists
  if (!fs.existsSync(crawlPath)) {
    throw new Error(
      `Crawl file not found: ${crawlPath}\n` +
      `Run: npx ts-node src/pf/crawl.ts <URL> --maxPages=10`
    );
  }

  // Load crawl data
  const crawl = JSON.parse(fs.readFileSync(crawlPath, "utf-8"));

  // Auto-read waitAfter from crawl report if not provided via CLI
  const waitAfter = config.waitAfter ?? crawl.limits?.waitAfter ?? 3000;

  // Use visitedUrls (actually crawled) instead of discoveredUrls
  const sourceUrls = Array.isArray(crawl.visitedUrls) && crawl.visitedUrls.length > 0
    ? crawl.visitedUrls
    : crawl.discoveredUrls || [];
  
  if (sourceUrls.length === 0) {
    throw new Error(`No URLs found in crawl file: ${crawlPath}`);
  }

  // Deduplicate
  const deduped = deduplicateUrls(sourceUrls);
  
  // Use maxUrls override if provided, otherwise use all crawled URLs
  const maxUrls = config.maxUrls || deduped.length;
  const urls = deduped.slice(0, maxUrls);

  logger.info(`Pathfinder Analysis`);
  logger.info(`Crawl file: ${path.basename(crawlPath)}`);
  logger.info(`URLs to analyze: ${urls.length}`);
  logger.info(`Delay: ${config.delayMs || 0}ms between requests`);
  if (waitAfter > 0) {
    const source = config.waitAfter ? "CLI override" : "crawl config";
    logger.info(`SPA wait: ${waitAfter}ms after page load (${source})\n`);
  } else {
    logger.info("");
  }

  logger.debug(`Source URLs before dedup: ${sourceUrls.length}`);
  logger.debug(`After deduplication: ${deduped.length}`);
  logger.debug(`Max URLs to process: ${maxUrls}`);

  const pages = [];
  const errors: { url: string; error: string }[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    logger.info(`[${i + 1}/${urls.length}] ${url}`);

    try {
      // Pass waitAfter (from CLI or crawl config)
      const scan = await scanPageLocators(url, waitAfter);
      const scored = scorePageScan(scan);
      pages.push(scored);

      logger.info(`  > Found ${scored.locators.length} locators (avg score: ${scored.scoreStats.average})`);
      logger.debug(`    Grade distribution: A=${scored.scoreStats.gradeDistribution.A} B=${scored.scoreStats.gradeDistribution.B} C=${scored.scoreStats.gradeDistribution.C} D=${scored.scoreStats.gradeDistribution.D} F=${scored.scoreStats.gradeDistribution.F}`);

      if (config.delayMs && i < urls.length - 1) {
        logger.debug(`Waiting ${config.delayMs}ms before next URL...`);
        await new Promise(r => setTimeout(r, config.delayMs));
      }
    } catch (e: any) {
      logger.error(`Failed: ${e.message}`, e);
      errors.push({ url, error: e.message });
    }
  }

  logger.info(`\nAnalysis complete`);
  logger.info(`Success: ${pages.length}/${urls.length}`);
  if (errors.length > 0) {
    logger.info(`Failures: ${errors.length}`);
    logger.debug(`Failed URLs: ${errors.map(e => e.url).join(', ')}`);
  }

  // Build aggregate statistics
  const totalLocators = pages.reduce((s, p) => s + p.locators.length, 0);
  
  const strategyDistribution: Record<LocatorStrategy, number> = {
    role: 0, label: 0, placeholder: 0, aria_label: 0, title: 0, name_attr: 0,
    id_attr: 0, autocomplete: 0, testId: 0, text: 0, css: 0, xpath: 0,
    data_attr: 0, class: 0,
  };
  
  const overallGradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };

  for (const page of pages) {
    for (const [strategy, count] of Object.entries(page.stats.byStrategy)) {
      strategyDistribution[strategy as LocatorStrategy] = 
        (strategyDistribution[strategy as LocatorStrategy] || 0) + count;
    }

    for (const [grade, count] of Object.entries(page.scoreStats.gradeDistribution)) {
      overallGradeDistribution[grade as keyof typeof overallGradeDistribution] += count;
    }
  }

  logger.debug(`Total locators found: ${totalLocators}`);
  logger.debug(`Overall grade distribution: ${JSON.stringify(overallGradeDistribution)}`);

  // Global recommendations
  const globalRecommendations = {
    bestPractices: [] as string[],
    criticalIssues: [] as string[],
    quickWins: [] as string[],
  };

  const pagesWithDuplicateIds = pages.filter(p => p.issues.duplicateIds.length > 0).length;
  const pagesWithoutTestIds = pages.filter(p => p.issues.missingTestIds > 0).length;
  const totalCriticalIssues = pages.reduce((s, p) => s + p.recommendations.criticalIssues.length, 0);

  if (pagesWithDuplicateIds > 0) {
    globalRecommendations.criticalIssues.push(
      `${pagesWithDuplicateIds} pages have duplicate IDs - fix immediately`
    );
  }

  if (pagesWithoutTestIds === pages.length) {
    globalRecommendations.quickWins.push(
      "No pages use data-testid - add this to all interactive elements"
    );
  } else if (pagesWithoutTestIds > pages.length / 2) {
    globalRecommendations.quickWins.push(
      `${pagesWithoutTestIds}/${pages.length} pages lack data-testid - prioritize adding them`
    );
  }

  const avgDepth = pages.reduce((s, p) => s + p.stats.averageDepth, 0) / pages.length;
  if (avgDepth > 10) {
    globalRecommendations.bestPractices.push(
      `Average DOM depth is ${avgDepth.toFixed(1)} - consider flattening structure`
    );
  }

  const report: SiteLocatorReport = {
    tool: "Pathfinder",
    version: "1.3.0",
    runId: runId(),
    seedUrl: urls[0],
    scannedUrls: urls,
    startedAt: new Date(startTime).toISOString(),
    finishedAt: new Date().toISOString(),
    totalDuration: Date.now() - startTime,
    pages,
    aggregate: {
      totalPages: pages.length,
      totalLocators,
      averageLocatorsPerPage: pages.length > 0 ? Math.round(totalLocators / pages.length) : 0,
      averageStabilityScore: pages.length > 0
        ? Math.round(pages.reduce((s, p) => s + p.scoreStats.average, 0) / pages.length)
        : 0,
      strategyDistribution,
      overallGradeDistribution,
      pagesWithDuplicateIds,
      pagesWithoutTestIds,
      totalCriticalIssues,
    },
    globalRecommendations,
  };

  const hostBase = extractHostBase(report.seedUrl);
  const saved = saveReport(hostBase, "pathfinder", report, reportsDir);

  logger.info(`\nReports saved:`);
  logger.info(`  - ${path.basename(saved.timestamped)}`);
  logger.info(`  - ${path.basename(saved.latest)}`);
  logger.info(`\nDuration: ${formatDuration(report.totalDuration)}`);

  logger.debug(`Full report path: ${saved.timestamped}`);

  return report;
}

// ============================================================================
// CLI USAGE - UPDATED with --waitAfter flag
// ============================================================================
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Parse --waitAfter flag
  const waitAfterArg = args.find(a => a.startsWith('--waitAfter='));
  const waitAfter = waitAfterArg ? parseInt(waitAfterArg.split('=')[1], 10) : undefined;
  
  // Parse --maxUrls flag
  const maxUrlsArg = args.find(a => a.startsWith('--maxUrls='));
  const maxUrls = maxUrlsArg ? parseInt(maxUrlsArg.split('=')[1], 10) : undefined;
  
  // First non-flag argument is the crawl report path
  const crawlPath = args.find(a => !a.startsWith('--'));
  
  orchestrate({
    crawlReportPath: crawlPath,
    maxUrls: maxUrls,
    delayMs: 1000,
    waitAfter: waitAfter,  // NEW: Pass waitAfter config
    reportsDir: path.resolve(process.cwd(), "reports"),
  })
    .then(() => logger.info("\nDone!"))
    .catch(err => {
      logger.error("\nError:", err);
      process.exit(1);
    });
}
