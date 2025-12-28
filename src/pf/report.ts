// src/pf/report.ts

import { SiteLocatorReport } from "./types";
import fs from "fs";

export function generateMarkdownReport(report: SiteLocatorReport): string {
  return `# Pathfinder Report

Site: ${report.seedUrl}
Date: ${report.finishedAt}

## Summary Statistics

- Pages Analyzed: ${report.aggregate.totalPages}
- Total Locators: ${report.aggregate.totalLocators}
- Average Score: ${report.aggregate.averageStabilityScore}/100

## Grade Distribution

${Object.entries(report.aggregate.overallGradeDistribution).map(([grade, count]) => 
  `${grade}: ${count} locators`
).join('\n')}

## Top Performing Pages

${report.pages
  .sort((a, b) => b.scoreStats.average - a.scoreStats.average)
  .slice(0, 5)
  .map((page, index) => 
    `${index + 1}. ${page.url} (Score: ${page.scoreStats.average}/100)`
  ).join('\n')}
`;
}

export function saveMarkdownReport(report: SiteLocatorReport, path: string): void {
  fs.writeFileSync(path, generateMarkdownReport(report), "utf-8");
}
