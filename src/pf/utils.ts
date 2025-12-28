// src/pf/utils.ts - Shared utilities
import fs from "fs";
import path from "path";
/**
* Generate run ID with timestamp
*/
export function runId(): string {
return `run-${Date.now()}`;
}
/**
* Get current timestamp in ISO format
*/
export function nowIso(): string {
return new Date().toISOString();
}
/**
* Format timestamp for filenames (human + computer readable)
* Format: YYYY-MM-DD_HH-MM-SS
* Example: 2024-12-28_22-44-07
*/
export function timestampForFilename(date: Date = new Date()): string {
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, "0");
const day = String(date.getDate()).padStart(2, "0");
const hours = String(date.getHours()).padStart(2, "0");
const minutes = String(date.getMinutes()).padStart(2, "0");
const seconds = String(date.getSeconds()).padStart(2, "0");
return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}
/**
* Generate next run file paths
* Creates both timestamped archive and .latest symlink
*/
export function nextRunFiles(
baseName: string,
fileType: string,
reportsDir: string
): {
timestamped: string;
latest: string;
} {
const timestamp = timestampForFilename();
return {
timestamped: path.join(reportsDir, `${baseName}.${fileType}.${timestamp}.json`),
latest: path.join(reportsDir, `${baseName}.${fileType}.latest.json`),
};
}
/**
* Save JSON with both timestamped archive and latest
*/
export function saveReport(
baseName: string,
fileType: string,
data: any,
reportsDir: string = path.resolve(process.cwd(), "reports")
): {
timestamped: string;
latest: string;
} {
fs.mkdirSync(reportsDir, { recursive: true });
const files = nextRunFiles(baseName, fileType, reportsDir);
const json = JSON.stringify(data, null, 2);
// Save timestamped archive
fs.writeFileSync(files.timestamped, json, "utf-8");
// Save latest (overwrite)
fs.writeFileSync(files.latest, json, "utf-8");
return files;
}
/**
* Load latest report if it exists
*/
export function loadLatestReport<T>(
baseName: string,
fileType: string,
reportsDir: string = path.resolve(process.cwd(), "reports")
): T | null {
const latestPath = path.join(reportsDir, `${baseName}.${fileType}.latest.json`);
if (!fs.existsSync(latestPath)) {
return null;
}
try {
const content = fs.readFileSync(latestPath, "utf-8");
return JSON.parse(content) as T;
} catch {
return null;
}
}
/**
* Get all archived reports for a site
*/
export function getArchivedReports(
baseName: string,
fileType: string,
reportsDir: string = path.resolve(process.cwd(), "reports")
): string[] {
if (!fs.existsSync(reportsDir)) {
return [];
}
const pattern = new RegExp(`^${baseName}\\.${fileType}\\.(\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2})\\.json$`);
const files = fs.readdirSync(reportsDir)
.filter(f => pattern.test(f))
.sort() // Alphabetical = chronological due to timestamp format
.map(f => path.join(reportsDir, f));
return files;
}
/**
* Extract hostname base from URL
*/
export function extractHostBase(url: string): string {
try {
const hostname = new URL(url).hostname.replace(/^www\./, "");
return hostname.split(".")[0];
} catch {
return "unknown";
}
}
/**
* Calculate duration in human-readable format
*/
export function formatDuration(ms: number): string {
if (ms < 1000) return `${ms}ms`;
if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
return `${(ms / 3600000).toFixed(1)}h`;
}
/**
* Calculate median from array of numbers
*/
export function median(numbers: number[]): number {
if (numbers.length === 0) return 0;
const sorted = [...numbers].sort((a, b) => a - b);
const mid = Math.floor(sorted.length / 2);
if (sorted.length % 2 === 0) {
return (sorted[mid - 1] + sorted[mid]) / 2;
}
return sorted[mid];
}
/**
* Safe text extraction (trim and normalize whitespace)
*/
export function safeText(text: string | null | undefined): string {
return (text ?? "").replace(/\s+/g, " ").trim();
}
/**
* Sleep utility
*/
export function sleep(ms: number): Promise<void> {
return new Promise(resolve => setTimeout(resolve, ms));
}
/**
* Retry with exponential backoff
*/
export async function retry<T>(
fn: () => Promise<T>,
maxAttempts: number = 3,
delayMs: number = 1000
): Promise<T> {
let lastError: Error | undefined;
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
try {
return await fn();
} catch (error) {
lastError = error as Error;
if (attempt < maxAttempts) {
await sleep(delayMs * attempt); // Exponential backoff
}
}
}
throw lastError;
}