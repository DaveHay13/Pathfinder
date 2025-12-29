// src/pf/summary.ts - Generate summary for a single site
import { SiteLocatorReport, PageLocatorReport } from "./types";
import { logger } from "./logger";
import fs from "fs";
import path from "path";

interface PageSummary {
  url: string;
  locators: number;
  avgScore: number;
  grade: string;
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
  topIssues: string[];
  recommendations: string[];
}

/**
 * Convert score to letter grade
 */
function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Analyze a single page
 */
function analyzePage(page: PageLocatorReport): PageSummary {
  const topIssues: string[] = [];
  
  if (page.issues.duplicateIds.length > 0) {
    topIssues.push(`Duplicate IDs: ${page.issues.duplicateIds.slice(0, 3).join(', ')}`);
  }
  
  if (page.issues.noStableLocator > 0) {
    topIssues.push(`${page.issues.noStableLocator} elements lack stable locators`);
  }
  
  if (page.issues.deeplyNested > 0) {
    topIssues.push(`${page.issues.deeplyNested} elements deeply nested (>10 levels)`);
  }
  
  if (page.issues.dynamicClasses.length > 0) {
    topIssues.push(`Dynamic classes detected: ${page.issues.dynamicClasses.slice(0, 3).join(', ')}`);
  }

  return {
    url: page.url,
    locators: page.locators.length,
    avgScore: page.scoreStats.average,
    grade: scoreToGrade(page.scoreStats.average),
    gradeDistribution: page.scoreStats.gradeDistribution,
    topIssues,
    recommendations: [
      ...page.recommendations.criticalIssues.slice(0, 3),
      ...page.recommendations.improvements.slice(0, 2),
    ],
  };
}

/**
 * Generate markdown summary for a single site
 */
function generateMarkdown(report: SiteLocatorReport): string {
  const hostname = new URL(report.seedUrl).hostname.replace(/^www\./, '');
  const siteName = hostname.split('.')[0].toUpperCase();
  
  let md = `# ${siteName} - Pathfinder Analysis Report\n\n`;
  md += `**Generated:** ${new Date(report.finishedAt).toLocaleString()}\n`;
  md += `**Duration:** ${(report.totalDuration / 1000).toFixed(1)}s\n`;
  md += `**Version:** ${report.version}\n\n`;
  
  md += '---\n\n';
  md += '## Executive Summary\n\n';
  md += `- **Pages Analyzed:** ${report.aggregate.totalPages}\n`;
  md += `- **Total Locators:** ${report.aggregate.totalLocators}\n`;
  md += `- **Average Score:** ${report.aggregate.averageStabilityScore}/100\n`;
  md += `- **Overall Grade:** ${scoreToGrade(report.aggregate.averageStabilityScore)}\n\n`;
  
  const grades = report.aggregate.overallGradeDistribution;
  const total = grades.A + grades.B + grades.C + grades.D + grades.F;
  const goodPercent = Math.round(((grades.A + grades.B) / total) * 100);
  const badPercent = Math.round(((grades.D + grades.F) / total) * 100);
  
  md += `**Health Status:**\n`;
  if (goodPercent >= 70) {
    md += `- Status: GOOD - ${goodPercent}% of locators are grade A/B\n`;
  } else if (goodPercent >= 50) {
    md += `- Status: FAIR - ${goodPercent}% of locators are grade A/B, ${badPercent}% need attention\n`;
  } else {
    md += `- Status: POOR - Only ${goodPercent}% of locators are grade A/B, ${badPercent}% are risky/failing\n`;
  }
  
  md += '\n---\n\n';
  md += '## Grade Distribution\n\n';
  md += '| Grade | Count | Percentage | Quality |\n';
  md += '|-------|-------|------------|----------|\n';
  md += `| A | ${grades.A} | ${Math.round((grades.A / total) * 100)}% | Excellent - Use these |\n`;
  md += `| B | ${grades.B} | ${Math.round((grades.B / total) * 100)}% | Good - Safe to use |\n`;
  md += `| C | ${grades.C} | ${Math.round((grades.C / total) * 100)}% | Acceptable - Monitor |\n`;
  md += `| D | ${grades.D} | ${Math.round((grades.D / total) * 100)}% | Risky - Consider alternatives |\n`;
  md += `| F | ${grades.F} | ${Math.round((grades.F / total) * 100)}% | Failing - Will break |\n\n`;
  
  md += '---\n\n';
  md += '## Critical Issues\n\n';
  
  if (report.globalRecommendations.criticalIssues.length > 0) {
    report.globalRecommendations.criticalIssues.forEach((issue: string) => {
      md += `- ${issue}\n`;
    });
  } else {
    md += 'No critical issues detected.\n';
  }
  
  md += '\n---\n\n';
  md += '## Quick Wins\n\n';
  
  if (report.globalRecommendations.quickWins.length > 0) {
    report.globalRecommendations.quickWins.forEach((win: string) => {
      md += `- ${win}\n`;
    });
  } else {
    md += 'No quick wins identified.\n';
  }
  
  if (report.globalRecommendations.bestPractices.length > 0) {
    md += '\n**Best Practices:**\n';
    report.globalRecommendations.bestPractices.forEach((practice: string) => {
      md += `- ${practice}\n`;
    });
  }
  
  md += '\n---\n\n';
  md += '## Page-by-Page Analysis\n\n';
  
  const pages = report.pages.map(analyzePage);
  const sortedPages = pages.sort((a: PageSummary, b: PageSummary) => a.avgScore - b.avgScore);
  
  md += '### Pages Needing Attention (Lowest Scores)\n\n';
  
  sortedPages.slice(0, 3).forEach((page: PageSummary, index: number) => {
    md += `#### ${index + 1}. ${page.url}\n\n`;
    md += `**Score:** ${page.avgScore}/100 (Grade ${page.grade})\n\n`;
    md += `**Locators:** ${page.locators} total | `;
    md += `A:${page.gradeDistribution.A} B:${page.gradeDistribution.B} C:${page.gradeDistribution.C} `;
    md += `D:${page.gradeDistribution.D} F:${page.gradeDistribution.F}\n\n`;
    
    if (page.topIssues.length > 0) {
      md += '**Issues:**\n';
      page.topIssues.forEach((issue: string) => md += `- ${issue}\n`);
      md += '\n';
    }
    
    if (page.recommendations.length > 0) {
      md += '**Recommended Actions:**\n';
      page.recommendations.forEach((rec: string) => md += `- ${rec}\n`);
      md += '\n';
    }
  });
  
  if (sortedPages.length > 3) {
    md += '### Top Performing Pages\n\n';
    sortedPages.slice(-3).reverse().forEach((page: PageSummary, index: number) => {
      md += `${index + 1}. **${page.url}** - ${page.avgScore}/100 (Grade ${page.grade})\n`;
    });
    md += '\n';
  }
  
  md += '---\n\n';
  md += '## Locator Strategy Breakdown\n\n';
  md += '| Strategy | Count | Percentage |\n';
  md += '|----------|-------|------------|\n';
  
  const strategies = Object.entries(report.aggregate.strategyDistribution)
    .filter(([_, count]) => (count as number) > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number));
  
  strategies.forEach(([strategy, count]) => {
    const percent = Math.round(((count as number) / report.aggregate.totalLocators) * 100);
    md += `| ${strategy} | ${count} | ${percent}% |\n`;
  });
  
  md += '\n---\n\n';
  md += '## Action Items\n\n';
  md += '### High Priority\n';
  
  const highPriority: string[] = [];
  if (report.aggregate.pagesWithDuplicateIds > 0) {
    highPriority.push(`Fix duplicate IDs on ${report.aggregate.pagesWithDuplicateIds} pages`);
  }
  if (badPercent > 30) {
    highPriority.push(`${badPercent}% of locators are grade D/F - systematic refactoring needed`);
  }
  
  if (highPriority.length > 0) {
    highPriority.forEach((item: string) => md += `1. ${item}\n`);
  } else {
    md += 'No high-priority items.\n';
  }
  
  md += '\n### Medium Priority\n';
  
  const mediumPriority: string[] = [];
  if (report.aggregate.pagesWithoutTestIds > report.aggregate.totalPages / 2) {
    mediumPriority.push(`Add data-testid attributes (${report.aggregate.pagesWithoutTestIds}/${report.aggregate.totalPages} pages lack them)`);
  }
  
  if (mediumPriority.length > 0) {
    mediumPriority.forEach((item: string) => md += `1. ${item}\n`);
  } else {
    md += 'No medium-priority items.\n';
  }
  
  md += '\n---\n\n';
  md += '*Generated by Pathfinder - Autonomous Test Locator Intelligence System*\n';
  
  return md;
}

/**
 * Generate site summary
 */
export async function generateSiteSummary(reportPath: string) {
  logger.info(`Loading report: ${reportPath}`);
  
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Report not found: ${reportPath}`);
  }
  
  const content = fs.readFileSync(reportPath, 'utf-8');
  const report = JSON.parse(content) as SiteLocatorReport;
  
  const markdown = generateMarkdown(report);
  
  const dir = path.dirname(reportPath);
  const basename = path.basename(reportPath, '.json');
  const outputPath = path.join(dir, `${basename}.SUMMARY.md`);
  
  fs.writeFileSync(outputPath, markdown, 'utf-8');
  logger.info(`Summary saved: ${outputPath}`);
  
  console.log('\n' + markdown);
  
  return outputPath;
}

// CLI usage
if (require.main === module) {
  const reportPath = process.argv[2];
  
  if (!reportPath) {
    logger.error('Usage: npx ts-node src/pf/summary.ts <report-path>');
    logger.error('Example: npx ts-node src/pf/summary.ts reports/cymbal-bank.pathfinder.latest.json');
    process.exit(1);
  }
  
  generateSiteSummary(reportPath)
    .then(() => logger.info('\nDone!'))
    .catch(err => {
      logger.error('Summary generation failed', err);
      process.exit(1);
    });
}