// src/pf/scan_locators.ts - Extract all locators from a page
import { chromium, Page, Locator } from "playwright";
import { ExtractedLocator, PageLocatorScan, LocatorStrategy } from "./types";
import { safeText, retry } from "./utils";
/**
* Generate XPath for an element
*/
async function getXPath(locator: Locator): Promise<string> {
try {
return await locator.evaluate((el) => {
const getPath = (element: Element): string => {
if (element.id) return `//*[@id="${element.id}"]`;
if (element === document.body) return "/html/body";
let ix = 0;
const siblings = element.parentNode?.children || [];
for (let i = 0; i < siblings.length; i++) {
const sibling = siblings[i];
if (sibling === element) {
return `${getPath(element.parentElement!)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
}
if (sibling.tagName === element.tagName) ix++;
}
return "";
};
return getPath(el);
});
} catch {
return "";
}
}
/**
* Generate CSS selector for an element
*/
async function getCssSelector(locator: Locator): Promise<string> {
try {
return await locator.evaluate((el) => {
if (el.id) return `#${el.id}`;
let path = el.tagName.toLowerCase();
if (el.className && typeof el.className === "string") {
const classes = el.className.split(" ").filter(Boolean);
if (classes.length > 0) path += `.${classes[0]}`;
}
if (el.parentElement) {
let index = 1;
let sibling = el.previousElementSibling;
while (sibling) {
if (sibling.tagName === el.tagName) index++;
sibling = sibling.previousElementSibling;
}
if (index > 1) path += `:nth-of-type(${index})`;
}
return path;
});
} catch {
return "";
}
}
/**
* Get DOM depth
*/
async function getDomDepth(locator: Locator): Promise<number> {
try {
return await locator.evaluate((el) => {
let depth = 0;
let current = el;
while (current.parentElement) {
depth++;
current = current.parentElement;
}
return depth;
});
} catch {
return 0;
}
}
/**
* Check if a class name looks dynamically generated
*/
function isDynamicClass(className: string): boolean {
const patterns = [
/^[a-z]-[0-9a-f]{5,}$/i,
/^[a-z]{1,3}[0-9]{3,}$/i,
/^_[a-z0-9_-]{10,}$/i,
/__[0-9a-f]{6,}/i,
/^css-[0-9a-z]{6,}$/i,
];
return patterns.some(p => p.test(className));
}
/**
* Extract all locators for an element
*/
async function extractLocatorsForElement(
locator: Locator,
page: Page
): Promise<ExtractedLocator | null> {
try {
const tagName = await locator.evaluate((el) => el.tagName.toLowerCase());
// Get all attributes
const id = await locator.getAttribute("id").catch(() => null);
const name = await locator.getAttribute("name").catch(() => null);
const testId = await locator.getAttribute("data-testid").catch(() => null);
const ariaLabel = await locator.getAttribute("aria-label").catch(() => null);
const role = await locator.getAttribute("role").catch(() => null);
const title = await locator.getAttribute("title").catch(() => null);
const placeholder = await locator.getAttribute("placeholder").catch(() => null);
const classAttr = await locator.getAttribute("class").catch(() => null);
const text = await locator.innerText().catch(() => null);
const classes = classAttr ? classAttr.split(" ").filter(Boolean) : [];
// Get structural info
const xpath = await getXPath(locator);
const cssSelector = await getCssSelector(locator);
const depth = await getDomDepth(locator);
const siblingCount = await locator.evaluate((el) =>
el.parentElement?.children.length || 0
);
const parentTag = await locator.evaluate((el) =>
el.parentElement?.tagName.toLowerCase() || ""
);
const parentClasses = await locator.evaluate((el) => {
const pc = el.parentElement?.className;
return pc && typeof pc === "string" ? pc.split(" ").filter(Boolean) : [];
});
// Build alternatives array
const alternatives: { strategy: LocatorStrategy; value: string; isUnique: boolean }[] = [];
// Test each strategy for uniqueness
if (id) {
const count = await page.locator(`#${id}`).count();
alternatives.push({ strategy: "id_attr", value: id, isUnique: count === 1 });
}
if (testId) {
const count = await page.locator(`[data-testid="${testId}"]`).count();
alternatives.push({ strategy: "testId", value: testId, isUnique: count === 1 });
}
if (ariaLabel) {
const count = await page.locator(`[aria-label="${ariaLabel}"]`).count();
alternatives.push({ strategy: "aria_label", value: ariaLabel, isUnique: count === 1 });
}
if (role) {
// For role, we need to be more careful with counting
try {
const count = await page.locator(`[role="${role}"]`).count();
alternatives.push({ strategy: "role", value: role, isUnique: count === 1 });
} catch {
alternatives.push({ strategy: "role", value: role, isUnique: false });
}
}
if (name) {
const count = await page.locator(`[name="${name}"]`).count();
alternatives.push({ strategy: "name_attr", value: name, isUnique: count === 1 });
}
if (title) {
const count = await page.locator(`[title="${title}"]`).count();
alternatives.push({ strategy: "title", value: title, isUnique: count === 1 });
}
if (placeholder) {
const count = await page.locator(`[placeholder="${placeholder}"]`).count();
alternatives.push({ strategy: "placeholder", value: placeholder, isUnique: count === 1 });
}
if (text && text.trim().length > 0 && text.trim().length < 50) {
const cleanText = safeText(text);
try {
const count = await page.getByText(cleanText, { exact: true }).count();
alternatives.push({ strategy: "text", value: cleanText, isUnique: count === 1 });
} catch {
// Text might have special chars that break the selector
}
}
if (classes.length > 0) {
const firstClass = classes[0];
const count = await page.locator(`.${firstClass}`).count();
alternatives.push({ strategy: "class", value: firstClass, isUnique: count === 1 });
}
// XPath and CSS as fallbacks
alternatives.push({ strategy: "xpath", value: xpath, isUnique: true });
alternatives.push({ strategy: "css", value: cssSelector, isUnique: false });
// Choose primary strategy (best available)
let primaryStrategy: LocatorStrategy = "xpath";
let primaryValue = xpath;
let isUnique = true;
// Priority: testId > id > aria-label > role > name > text > class > xpath
const priority: LocatorStrategy[] = [
"testId", "id_attr", "aria_label", "role",
"name_attr", "text", "class"
];
for (const strat of priority) {
const alt = alternatives.find(a => a.strategy === strat && a.isUnique);
if (alt) {
primaryStrategy = alt.strategy;
primaryValue = alt.value;
isUnique = alt.isUnique;
break;
}
}
// Determine element type
const elementType =
tagName === "button" ? "button" :
tagName === "a" ? "link" :
tagName === "input" ? "input" :
tagName === "select" ? "select" :
tagName === "textarea" ? "textarea" :
tagName.match(/^h[1-6]$/) ? "heading" :
tagName === "form" ? "form" :
"other";
return {
tagName,
elementType,
strategy: primaryStrategy,
value: primaryValue,
alternatives,
xpath,
cssSelector,
depth,
text: text || undefined,
ariaLabel: ariaLabel || undefined,
role: role || undefined,
classes: classes.length > 0 ? classes : undefined,
id: id || undefined,
name: name || undefined,
isUnique,
siblingCount,
parentTag: parentTag || undefined,
parentClasses: parentClasses.length > 0 ? parentClasses : undefined,
};
} catch {
return null;
}
}
/**
* Handle cookie banner if present
*/
async function handleCookieBanner(page: Page): Promise<void> {
try {
// Common cookie banner selectors
const cookieSelectors = [
'button:has-text("Accept")',
'button:has-text("Agree")',
'button:has-text("OK")',
'[aria-label*="cookie" i] button',
'[id*="cookie" i] button',
];
for (const selector of cookieSelectors) {
try {
const button = page.locator(selector).first();
if (await button.isVisible({ timeout: 2000 })) {
await button.click({ timeout: 3000 });
await page.waitForTimeout(500);
return;
}
} catch {
// Try next selector
}
}
} catch {
// Cookie banner handling failed - continue anyway
}
}
/**
* Scan a page and extract all locators
*/
export async function scanPageLocators(url: string): Promise<PageLocatorScan> {
const startTime = Date.now();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
viewport: { width: 1366, height: 900 },
});
page.setDefaultTimeout(30000);
try {
// Navigate with retry
await retry(async () => {
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
});
await page.waitForTimeout(1500);
// Handle cookie banner
await handleCookieBanner(page);
await page.waitForTimeout(500);
// Get all interactive and important elements
const selectors = [
"button",
"a[href]",
"input",
"select",
"textarea",
"[role='button']",
"[role='link']",
"[role='textbox']",
"h1, h2, h3, h4, h5, h6",
"form",
"[data-testid]", // Explicitly include elements with test IDs
];
const allElements = await page.locator(selectors.join(", ")).all();
const locators: ExtractedLocator[] = [];
const issues = {
duplicateIds: [] as string[],
missingTestIds: 0,
deeplyNested: 0,
dynamicClasses: [] as string[],
noStableLocator: 0,
};
const seenIds = new Set<string>();
// Extract locators for each element
for (const element of allElements) {
const extracted = await extractLocatorsForElement(element, page);
if (!extracted) continue;
locators.push(extracted);
// Track issues
if (extracted.id) {
if (seenIds.has(extracted.id)) {
if (!issues.duplicateIds.includes(extracted.id)) {
issues.duplicateIds.push(extracted.id);
}
}
seenIds.add(extracted.id);
}
if (!extracted.alternatives.some(a => a.strategy === "testId")) {
issues.missingTestIds++;
}
if (extracted.depth > 10) {
issues.deeplyNested++;
}
if (extracted.classes) {
const dynamic = extracted.classes.filter(isDynamicClass);
dynamic.forEach(c => {
if (!issues.dynamicClasses.includes(c)) {
issues.dynamicClasses.push(c);
}
});
}
const hasGoodLocator = extracted.alternatives.some(
a => a.isUnique && ["testId", "id_attr", "aria_label"].includes(a.strategy)
);
if (!hasGoodLocator) {
issues.noStableLocator++;
}
}
// Calculate statistics
const byStrategy: Record<string, number> = {};
const byElementType: Record<string, number> = {};
let totalDepth = 0;
for (const loc of locators) {
byStrategy[loc.strategy] = (byStrategy[loc.strategy] || 0) + 1;
byElementType[loc.elementType] = (byElementType[loc.elementType] || 0) + 1;
totalDepth += loc.depth;
}
const uniqueLocators = locators.filter(l => l.isUnique).length;
return {
url,
scannedAt: new Date().toISOString(),
duration: Date.now() - startTime,
locators,
stats: {
totalElements: allElements.length,
totalLocators: locators.length,
uniqueLocators,
byStrategy,
byElementType,
averageDepth: locators.length > 0 ? totalDepth / locators.length : 0,
},
issues,
};
} finally {
await browser.close();
}
}
// CLI usage
if (require.main === module) {
const url = process.argv[2] || "https://www.imdb.com/";
console.log(`Scanning ${url}...`);
scanPageLocators(url)
.then(result => {
console.log(JSON.stringify(result, null, 2));
console.log(`\nScan complete: ${result.stats.totalLocators} locators found`);
})
.catch(err => {
console.error("Scan failed:", err.message);
process.exit(1);
});
}