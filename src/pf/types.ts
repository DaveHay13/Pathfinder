// src/pf/types.ts - Extended Pathfinder types
// ============================================================================
// EXISTING TYPES (Your original auth scanner types)
// ============================================================================
export type ElementKind =
| "input"
| "button"
| "link"
| "auth_entry"
| "form"
| "general"; // Added for general locator scanning
export type LocatorStrategy =
| "role"
| "label"
| "placeholder"
| "aria_label"
| "title"
| "name_attr"
| "id_attr"
| "autocomplete"
| "testId"
| "text"
| "css"
| "xpath"
| "data_attr"
| "class"; // Extended strategies
export interface DiscoveredElement {
kind: ElementKind;
strategy: LocatorStrategy;
value: string;
reason: string;
evidence?: string;
}
export type CookieStatus =
| "not_detected"
| "detected"
| "handled"
| "detected_not_handled";
// ============================================================================
// NEW TYPES (Locator extraction and scoring for Pathfinder Lite)
// ============================================================================
export interface ExtractedLocator {
// Element identification
tagName: string;
elementType: string; // button, input, link, etc.
// Primary locator
strategy: LocatorStrategy;
value: string;
// Alternative locators (all possible ways to find this element)
alternatives: {
strategy: LocatorStrategy;
value: string;
isUnique: boolean;
}[];
// Structural context
xpath: string;
cssSelector: string;
depth: number; // DOM depth
// Element attributes
text?: string;
ariaLabel?: string;
role?: string;
classes?: string[];
id?: string;
name?: string;
// Context analysis
isUnique: boolean; // Is primary locator unique?
siblingCount: number;
parentTag?: string;
parentClasses?: string[];
}
export interface LocatorScore {
locator: ExtractedLocator;
// Score components (0-100 each)
stabilityScore: number;    // How resistant to DOM changes
uniquenessScore: number;   // How unique on the page
depthScore: number;        // Penalty for deep nesting
strategyScore: number;     // Quality of locator strategy
// Total score (weighted average)
totalScore: number; // 0-100
grade: "A" | "B" | "C" | "D" | "F"; // Letter grade
// ELO rating (for future ML training)
eloRating: number; // Starts at 1500
// Explanation
reasoning: {
stability: string;
uniqueness: string;
depth: string;
strategy: string;
};
// Recommendations
recommended: boolean;
warnings: string[];
betterAlternatives?: string[]; // Suggestions for better locators
}
export interface PageLocatorScan {
url: string;
scannedAt: string;
duration: number; // milliseconds
// All extracted locators
locators: ExtractedLocator[];
// Statistics
stats: {
totalElements: number;
totalLocators: number;
uniqueLocators: number;
byStrategy: Record<LocatorStrategy, number>;
byElementType: Record<string, number>;
averageDepth: number;
};
// Issues found
issues: {
duplicateIds: string[];
missingTestIds: number;
deeplyNested: number; // Elements deeper than 10 levels
dynamicClasses: string[]; // Classes that look generated
noStableLocator: number; // Elements with no good locator
};
}
export interface PageLocatorReport extends PageLocatorScan {
// Scored locators
scored: LocatorScore[];
// Score distribution
scoreStats: {
average: number;
median: number;
min: number;
max: number;
gradeDistribution: Record<"A" | "B" | "C" | "D" | "F", number>;
};
// Recommendations
recommendations: {
topLocators: LocatorScore[]; // Top 10 best
riskyLocators: LocatorScore[]; // Bottom 10 worst
criticalIssues: string[];
improvements: string[];
};
}
export interface SiteLocatorReport {
tool: string;
version: string;
runId: string;
// Input
seedUrl: string;
scannedUrls: string[];
// Timing
startedAt: string;
finishedAt: string;
totalDuration: number; // milliseconds
// Results per page
pages: PageLocatorReport[];
// Aggregate statistics across all pages
aggregate: {
totalPages: number;
totalLocators: number;
averageLocatorsPerPage: number;
averageStabilityScore: number;
// Strategy distribution
strategyDistribution: Record<LocatorStrategy, number>;
// Grade distribution across all locators
overallGradeDistribution: Record<"A" | "B" | "C" | "D" | "F", number>;
// Common issues
pagesWithDuplicateIds: number;
pagesWithoutTestIds: number;
totalCriticalIssues: number;
};
// Global recommendations
globalRecommendations: {
bestPractices: string[];
criticalIssues: string[];
quickWins: string[]; // Easy improvements with high impact
};
}