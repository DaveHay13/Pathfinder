// src/pf/orchestrate.ts

import { scanPageLocators } from "./scan_locators";
import { scorePageScan } from "./score";
import { SiteLocatorReport, LocatorStrategy } from "./types";
import { runId, saveReport, extractHostBase } from "./utils";
import fs from "fs";

export async function orchestrate(config: {
  crawlReportPath: string;
  maxUrls: number;
  delayMs: number;
  reportsDir: string;
}): Promise<SiteLocatorReport> {
  const startTime = Date.now();

  const crawl = JSON.parse(fs.readFileSync(config.crawlReportPath, "utf-8"));
  const urls = (crawl.discoveredUrls || []).slice(0, config.maxUrls);

  const pages = [];

  for (const url of urls) {
    try {
      console.log(`Scanning: ${url}`);
      const scan = await scanPageLocators(url);
      const scored = scorePageScan(scan);
      pages.push(scored);

      if (config.delayMs) await new Promise(r => setTimeout(r, config.delayMs));
    } catch (e) {
      console.error(`Failed: ${url}`, e);
    }
  }

  // Calculate aggregate strategy distribution
  const strategyDistribution: Record<LocatorStrategy, number> = {
    role: 0,
    label: 0,
    placeholder: 0,
    aria_label: 0,
    title: 0,
    name_attr: 0,
    id_attr: 0,
    autocomplete: 0,
    testId: 0,
    text: 0,
    css: 0,
    xpath: 0,
    data_attr: 0,
    class: 0,
  };

  // Calculate aggregate grade distribution
  const overallGradeDistribution: Record<"A" | "B" | "C" | "D" | "F", number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    F: 0,
  };

  // Aggregate statistics across all pages
  pages.forEach(page => {
    // Sum up strategies
    page.locators.forEach(loc => {
      strategyDistribution[loc.strategy] = (strategyDistribution[loc.strategy] || 0) + 1;
    });

    // Sum up grades
    page.scored.forEach(scored => {
      overallGradeDistribution[scored.grade]++;
    });
  });

  const report: SiteLocatorReport = {
    tool: "Pathfinder",
    version: "1.2.0",
    runId: runId(),
    seedUrl: urls[0],
    scannedUrls: urls,
    startedAt: new Date(startTime).toISOString(),
    finishedAt: new Date().toISOString(),
    totalDuration: Date.now() - startTime,
    pages,
    aggregate: {
      totalPages: pages.length,
      totalLocators: pages.reduce((s, p) => s + p.locators.length, 0),
      averageLocatorsPerPage: pages.length > 0 
        ? Math.round(pages.reduce((s, p) => s + p.locators.length, 0) / pages.length)
        : 0,
      averageStabilityScore: pages.length > 0
        ? Math.round(pages.reduce((s, p) => s + p.scoreStats.average, 0) / pages.length)
        : 0,
      strategyDistribution,
      overallGradeDistribution,
      pagesWithDuplicateIds: pages.filter(p => p.issues.duplicateIds.length > 0).length,
      pagesWithoutTestIds: pages.filter(p => p.issues.missingTestIds > 0).length,
      totalCriticalIssues: pages.reduce((s, p) => s + p.recommendations.criticalIssues.length, 0),
    },
    globalRecommendations: {
      bestPractices: [],
      criticalIssues: [],
      quickWins: []
    },
  };

  saveReport(extractHostBase(report.seedUrl), "pathfinder", report, config.reportsDir);

  console.log("\nAnalysis complete");
  console.log(`Total pages analyzed: ${report.aggregate.totalPages}`);
  console.log(`Total locators found: ${report.aggregate.totalLocators}`);
  console.log(`Average score: ${report.aggregate.averageStabilityScore}/100`);

  return report;
}

if (require.main === module) {
  orchestrate({
    crawlReportPath: process.argv[2] || "reports/imdb.crawl.latest.json",
    maxUrls: 10,
    delayMs: 1000,
    reportsDir: "reports",
  }).then(() => console.log("Done")).catch(console.error);
}