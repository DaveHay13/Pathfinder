// src/pf/training_data.ts

import { SiteLocatorReport } from "./types";
import fs from "fs";

export function exportTrainingData(report: SiteLocatorReport, outputPath: string): void {
  const rows = ["url,tagName,strategy,value,depth,isUnique,totalScore,grade,eloRating"];

  report.pages.forEach(page => {
    page.scored.forEach(scored => {
      const loc = scored.locator;
      rows.push([
        page.url,
        loc.tagName,
        loc.strategy,
        `"${loc.value.replace(/"/g, '""')}"`,
        loc.depth,
        loc.isUnique,
        scored.totalScore,
        scored.grade,
        scored.eloRating
      ].join(","));
    });
  });

  fs.writeFileSync(outputPath, rows.join("\n"), "utf-8");
}
