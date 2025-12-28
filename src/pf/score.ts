// src/pf/score.ts - Score locators for stability
import {
ExtractedLocator,
LocatorScore,
LocatorStrategy,
PageLocatorScan,
PageLocatorReport,
} from "./types";
import { median } from "./utils";
/**
* Strategy quality scores (0-100)
* Based on resistance to DOM changes and industry best practices
*/
const STRATEGY_SCORES: Record<LocatorStrategy, number> = {
testId: 100,        // Best: explicitly for testing
data_attr: 95,      // Excellent: custom data attributes
id_attr: 90,        // Great: unique identifiers
aria_label: 85,     // Great: semantic and accessible
role: 80,           // Good: semantic
autocomplete: 80,   // Good: stable for forms
name_attr: 75,      // Good: stable
label: 75,          // Good: stable
title: 70,          // Decent: can change with copy updates
placeholder: 70,    // Decent: can change with copy updates
text: 50,           // Risky: changes with copy
class: 40,          // Risky: CSS refactoring breaks it
css: 30,            // Poor: very brittle
xpath: 20,          // Very poor: extremely brittle
};
/**
* Initial ELO rating for all locators
* Will be updated based on temporal validation in V2.0
*/
const INITIAL_ELO = 1500;
/**
* Check if a class name looks dynamically generated
*/
function isDynamicClass(className: string): boolean {
const patterns = [
/^[a-z]-[0-9a-f]{5,}$/i,     // css-modules: "button-a1b2c3"
/^[a-z]{1,3}[0-9]{3,}$/i,    // short prefix + numbers: "st123"
/^_[a-z0-9_-]{10,}$/i,       // webpack: "_3x4y5z6..."
/__[0-9a-f]{6,}/i,           // hash suffix: "button__a1b2c3"
/^css-[0-9a-z]{6,}$/i,       // styled-components
];
return patterns.some(p => p.test(className));
}
/**
* Score uniqueness (0-100)
*/
function scoreUniqueness(locator: ExtractedLocator): number {
// Primary locator is unique
if (locator.isUnique) return 100;
// Has a unique alternative strategy
const hasUniqueAlt = locator.alternatives.some(
a => a.isUnique && STRATEGY_SCORES[a.strategy] >= 70
);
if (hasUniqueAlt) return 80;
// Has some unique alternative (even if low quality)
const hasAnyUnique = locator.alternatives.some(a => a.isUnique);
if (hasAnyUnique) return 60;
// No unique locator available - critical issue
return 20;
}
/**
* Score depth (0-100)
* Penalty for deeply nested elements
*/
function scoreDepth(depth: number): number {
if (depth <= 3) return 100;  // Very shallow - excellent
if (depth <= 5) return 90;   // Shallow - great
if (depth <= 8) return 75;   // Moderate - good
if (depth <= 10) return 60;  // Getting deep - acceptable
if (depth <= 15) return 40;  // Deep - risky
return 20;                    // Very deep - dangerous
}
/**
* Calculate stability score (0-100)
* How resistant is this locator to DOM changes?
*/
function scoreStability(locator: ExtractedLocator): number {
const { strategy, classes, text, alternatives } = locator;
let score = STRATEGY_SCORES[strategy];
// Penalty for dynamic classes
if (strategy === "class" && classes) {
const dynamicCount = classes.filter(isDynamicClass).length;
if (dynamicCount > 0) {
score -= (dynamicCount * 10); // -10 per dynamic class
}
}
// Penalty for long text (likely to change)
if (strategy === "text" && text) {
if (text.length > 50) score -= 20;
else if (text.length > 30) score -= 10;
}
// Bonus for having multiple high-quality alternatives
const goodAlts = alternatives.filter(
a => a.isUnique && STRATEGY_SCORES[a.strategy] >= 75
);
if (goodAlts.length >= 3) score += 15;
else if (goodAlts.length === 2) score += 10;
else if (goodAlts.length === 1) score += 5;
// Bonus for semantic HTML (has role or aria-label)
if (locator.role || locator.ariaLabel) {
score += 5;
}
return Math.max(0, Math.min(100, score));
}
/**
* Calculate total score (weighted average)
*/
function calculateTotalScore(
strategyScore: number,
uniquenessScore: number,
depthScore: number,
stabilityScore: number
): number {
// Weighted formula
const total =
(strategyScore * 0.40) +    // 40% - what kind of locator?
(uniquenessScore * 0.30) +  // 30% - is it unique?
(depthScore * 0.20) +       // 20% - how deep in DOM?
(stabilityScore * 0.10);    // 10% - other factors
return Math.round(total);
}
/**
* Assign letter grade based on score
*/
function assignGrade(score: number): "A" | "B" | "C" | "D" | "F" {
if (score >= 90) return "A"; // Excellent - use this
if (score >= 80) return "B"; // Good - safe to use
if (score >= 70) return "C"; // Acceptable - monitor
if (score >= 60) return "D"; // Risky - consider alternative
return "F";                   // Dangerous - will break
}
/**
* Generate reasoning for each score component
*/
function generateReasoning(
locator: ExtractedLocator,
scores: {
strategy: number;
uniqueness: number;
depth: number;
stability: number;
}
): {
strategy: string;
uniqueness: string;
depth: string;
stability: string;
} {
const strategyName = locator.strategy.replace(/_/g, " ");
return {
strategy: `Using ${strategyName} (score: ${scores.strategy}/100). ${
scores.strategy >= 90 ? "Excellent choice - highly resistant to changes." :
scores.strategy >= 75 ? "Good choice - reasonably stable." :
scores.strategy >= 60 ? "Acceptable but could be better." :
scores.strategy >= 40 ? "Risky - prone to breaking." :
"Very risky - highly brittle."
}`,
uniqueness: locator.isUnique
? `Unique on page (score: ${scores.uniqueness}/100). No ambiguity.`
: locator.alternatives.some(a => a.isUnique)
? `Not unique, but has unique alternative (score: ${scores.uniqueness}/100). Consider switching.`
: `Not unique on page (score: ${scores.uniqueness}/100). Critical issue - will match multiple elements.`,
depth: `DOM depth: ${locator.depth} levels (score: ${scores.depth}/100). ${
locator.depth <= 5 ? "Shallow nesting - excellent." :
locator.depth <= 10 ? "Moderate nesting - acceptable." :
"Deep nesting - refactoring could break this."
}`,
stability: `Stability analysis (score: ${scores.stability}/100). ${
locator.classes?.some(isDynamicClass)
? "Warning: Uses dynamically generated classes. "
: ""
}${
locator.text && locator.text.length > 30
? "Warning: Long text content may change. "
: ""
}${
locator.role || locator.ariaLabel
? "Bonus: Semantic HTML detected."
: ""
}`,
};
}
/**
* Generate warnings based on locator analysis
*/
function generateWarnings(locator: ExtractedLocator, totalScore: number): string[] {
const warnings: string[] = [];
// Critical warnings
if (!locator.isUnique && !locator.alternatives.some(a => a.isUnique)) {
warnings.push("CRITICAL: No unique locator available - will match multiple elements");
}
if (locator.strategy === "xpath" || locator.strategy === "css") {
warnings.push("Brittle locator type - highly likely to break with DOM changes");
}
if (locator.depth > 15) {
warnings.push("Extremely deep nesting - very fragile");
}
// Important warnings
if (locator.classes?.some(isDynamicClass)) {
const dynamicClasses = locator.classes.filter(isDynamicClass).join(", ");
warnings.push(`Dynamic classes detected: ${dynamicClasses}`);
}
if (locator.strategy === "text" && locator.text && locator.text.length > 50) {
warnings.push("Long text content - likely to change with copy updates");
}
if (totalScore < 60) {
warnings.push("Low overall score - find a better alternative");
}
return warnings;
}
/**
* Suggest better alternatives
*/
function suggestBetterAlternatives(locator: ExtractedLocator): string[] | undefined {
const suggestions: string[] = [];
// If not using best strategy, suggest better ones
const betterAlts = locator.alternatives.filter(
a => a.isUnique && STRATEGY_SCORES[a.strategy] > STRATEGY_SCORES[locator.strategy]
).sort((a, b) => STRATEGY_SCORES[b.strategy] - STRATEGY_SCORES[a.strategy]);
betterAlts.slice(0, 3).forEach(alt => {
suggestions.push(`Use ${alt.strategy.replace(/_/g, " ")}: "${alt.value}" (score: ${STRATEGY_SCORES[alt.strategy]}/100)`);
});
// Suggest adding data-testid if missing
if (!locator.alternatives.some(a => a.strategy === "testId")) {
suggestions.push("Add data-testid attribute for maximum stability");
}
return suggestions.length > 0 ? suggestions : undefined;
}
/**
* Score a single locator
*/
export function scoreLocator(locator: ExtractedLocator): LocatorScore {
// Calculate component scores
const strategyScore = STRATEGY_SCORES[locator.strategy];
const uniquenessScore = scoreUniqueness(locator);
const depthScore = scoreDepth(locator.depth);
const stabilityScore = scoreStability(locator);
// Calculate total score
const totalScore = calculateTotalScore(
strategyScore,
uniquenessScore,
depthScore,
stabilityScore
);
const grade = assignGrade(totalScore);
const reasoning = generateReasoning(locator, {
strategy: strategyScore,
uniqueness: uniquenessScore,
depth: depthScore,
stability: stabilityScore,
});
const warnings = generateWarnings(locator, totalScore);
const betterAlternatives = suggestBetterAlternatives(locator);
return {
locator,
stabilityScore,
uniquenessScore,
depthScore,
strategyScore,
totalScore,
grade,
eloRating: INITIAL_ELO, // Will be updated in V2.0 with temporal validation
reasoning,
recommended: totalScore >= 70, // Grade C or better
warnings,
betterAlternatives,
};
}
/**
* Score all locators from a page scan
*/
export function scorePageScan(scan: PageLocatorScan): PageLocatorReport {
const scored = scan.locators.map(scoreLocator);
// Calculate score statistics
const scores = scored.map(s => s.totalScore);
const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
const medianScore = median(scores);
const min = scores.length > 0 ? Math.min(...scores) : 0;
const max = scores.length > 0 ? Math.max(...scores) : 0;
// Grade distribution
const gradeDistribution = {
A: scored.filter(s => s.grade === "A").length,
B: scored.filter(s => s.grade === "B").length,
C: scored.filter(s => s.grade === "C").length,
D: scored.filter(s => s.grade === "D").length,
F: scored.filter(s => s.grade === "F").length,
};
// Get top and risky locators
const sortedByScore = [...scored].sort((a, b) => b.totalScore - a.totalScore);
const topLocators = sortedByScore.slice(0, 10);
const riskyLocators = sortedByScore.slice(-10).reverse();
// Generate recommendations
const criticalIssues: string[] = [];
const improvements: string[] = [];
// Check for critical issues
if (scan.issues.duplicateIds.length > 0) {
criticalIssues.push(`Duplicate IDs found: ${scan.issues.duplicateIds.join(", ")}`);
}
if (scan.issues.noStableLocator > 0) {
criticalIssues.push(`${scan.issues.noStableLocator} elements have no stable locator`);
}
const lowScoreCount = scored.filter(s => s.totalScore < 60).length;
if (lowScoreCount > 0) {
criticalIssues.push(`${lowScoreCount} locators have failing grades (D/F)`);
}
// Suggest improvements
if (scan.issues.missingTestIds > 0) {
improvements.push(`Add data-testid to ${scan.issues.missingTestIds} elements for better stability`);
}
if (scan.issues.dynamicClasses.length > 0) {
improvements.push(`Avoid dynamic classes like: ${scan.issues.dynamicClasses.slice(0, 3).join(", ")}`);
}
if (scan.stats.averageDepth > 10) {
improvements.push(`Reduce DOM nesting - average depth is ${scan.stats.averageDepth.toFixed(1)} levels`);
}
return {
...scan,
scored,
scoreStats: {
average: Math.round(average),
median: medianScore,
min,
max,
gradeDistribution,
},
recommendations: {
topLocators,
riskyLocators,
criticalIssues,
improvements,
},
};
}