# Pathfinder v1.3

**Autonomous Test Locator Intelligence System**

## Overview

Pathfinder analyzes web applications to identify and score DOM locators based on their stability and reliability for automated testing. The system crawls websites, extracts all possible locators for interactive elements, scores them using heuristic analysis, and generates actionable executive reports for test automation engineers.

**Key Value:** Predict which test locators will break *before* they break, eliminating the manual maintenance burden of test automation.

## Quick Start
```bash
# 1. Install dependencies
npm install
npx playwright install chromium

# 2. Crawl a website
npx ts-node src/pf/crawl.ts https://example.com --maxPages=5

# 3. Run Pathfinder analysis
npx ts-node src/pf/orchestrate.ts

# 4. Generate executive summary
npx ts-node src/pf/summary.ts reports/example.pathfinder.latest.json

# 5. View reports
ls reports/
```

## What You Get

### JSON Reports
- `site.crawl.latest.json` - Discovered URLs and crawl metadata
- `site.pathfinder.latest.json` - Complete analysis data with all locators
- Timestamped archives for historical tracking

### Markdown Reports
- `site.pathfinder.latest.SUMMARY.md` - Executive summary with:
  - **Health Status** - GOOD/FAIR/POOR assessment
  - **Grade Distribution** - Visual breakdown of A-F grades
  - **Critical Issues** - Must-fix problems (duplicate IDs, etc.)
  - **Quick Wins** - Easy improvements with high impact
  - **Page-by-Page Analysis** - Worst pages highlighted first
  - **Action Items** - Prioritized by high/medium urgency
  - **Locator Strategy Breakdown** - What selectors are being used

### CSV Training Data
- Machine-readable format for ML model training
- ELO ratings for temporal validation (V2.0)

## Architecture

### Core Components

| File | Purpose |
|------|---------|
| **crawl.ts** | Web crawler for URL discovery and site mapping |
| **scan_locators.ts** | DOM analysis and locator extraction engine |
| **score.ts** | Scoring algorithm with weighted stability heuristics |
| **orchestrate.ts** | Workflow orchestration and batch processing |
| **summary.ts** | Executive summary generation for single sites |
| **report.ts** | Multi-format report generation |
| **training_data.ts** | CSV export for ML training |
| **logger.ts** | Debug logging system with environment control |
| **types.ts** | TypeScript type definitions and interfaces |
| **utils.ts** | Shared utilities for file I/O and data processing |

### Technology Stack

- **TypeScript 5.0+** - Type-safe development
- **Playwright 1.40+** - Browser automation and DOM access
- **Node.js 20+** - Runtime environment

## Scoring System

Locators receive scores from **0-100** based on four weighted factors:

### 1. Strategy Quality (40% weight)
Best to worst locator types:
- `data-testid`: 100 (explicitly for testing)
- `data-*` attributes: 95 (custom, stable)
- `id`: 90 (unique identifiers)
- `aria-label`: 85 (semantic, accessible)
- `role`: 80 (semantic)
- `name`: 75 (form elements)
- `text`: 50 (changes with copy)
- `class`: 40 (CSS refactoring breaks)
- `css`: 30 (very brittle)
- `xpath`: 20 (extremely brittle)

### 2. Uniqueness (30% weight)
- 100: Locator uniquely identifies element
- 80: Has unique alternative strategy available
- 60: Some unique alternative exists
- 20: No unique locator available (CRITICAL)

### 3. DOM Depth (20% weight)
Penalty for deeply nested elements:
- Depth ≤3: 100 (shallow, excellent)
- Depth ≤5: 90 (shallow, great)
- Depth ≤8: 75 (moderate, good)
- Depth ≤10: 60 (getting deep)
- Depth >15: 20 (very fragile)

### 4. Stability Factors (10% weight)
Bonuses and penalties:
- **-10 per dynamic class** (e.g., `css-a1b2c3`)
- **-20 for long text** (>50 chars likely to change)
- **+5 for semantic HTML** (role or aria-label present)
- **+5-15 for multiple good alternatives**

### Letter Grades

| Grade | Score | Quality | Recommendation |
|-------|-------|---------|----------------|
| **A** | 90-100 | Excellent | Use these - highly stable |
| **B** | 80-89 | Good | Safe to use |
| **C** | 70-79 | Acceptable | Monitor for changes |
| **D** | 60-69 | Risky | Find better alternatives |
| **F** | 0-59 | Failing | Will break - fix immediately |

## Configuration

### Crawl Options
```bash
npx ts-node src/pf/crawl.ts <URL> [OPTIONS]

Options:
  --maxPages=N     Maximum pages to crawl (default: 50)
  --maxDepth=N     Maximum link depth (default: 2)
  --sameHost=true  Only crawl same hostname (default: true)
```

**Examples:**
```bash
# Crawl 10 pages, max depth 2
npx ts-node src/pf/crawl.ts https://example.com --maxPages=10

# Shallow crawl (homepage + direct links only)
npx ts-node src/pf/crawl.ts https://example.com --maxPages=5 --maxDepth=1

# Allow external links
npx ts-node src/pf/crawl.ts https://example.com --sameHost=false
```

### Analysis Options
```bash
# Auto-detect latest crawl
npx ts-node src/pf/orchestrate.ts

# Specify custom crawl file
npx ts-node src/pf/orchestrate.ts reports/custom.crawl.json
```

### Debug Mode

Enable verbose logging with progress tracking:
```bash
# Windows PowerShell
$env:DEBUG="true"; npx ts-node src/pf/orchestrate.ts

# Windows CMD
set DEBUG=true && npx ts-node src/pf/orchestrate.ts

# Linux/Mac
DEBUG=true npx ts-node src/pf/orchestrate.ts
```

Debug mode shows:
- Source URL deduplication stats
- Element processing progress (every 100 elements)
- Grade distribution per page
- Skipped element count
- Full stack traces on errors

## Example Output
```
CYMBAL-BANK - Pathfinder Analysis Report
==========================================

Executive Summary:
- Pages Analyzed: 2
- Total Locators: 25
- Average Score: 79/100
- Overall Grade: B

Health Status: GOOD - 72% of locators are grade A/B

Grade Distribution:
| Grade | Count | Percentage | Quality           |
|-------|-------|------------|-------------------|
| A     | 1     | 4%         | Excellent         |
| B     | 17    | 68%        | Good              |
| C     | 2     | 8%         | Acceptable        |
| D     | 3     | 12%        | Risky             |
| F     | 2     | 8%         | Failing           |

Critical Issues:
- None detected

Quick Wins:
- Add data-testid to 2 pages for maximum stability

Action Items:
High Priority:
- None

Medium Priority:
1. Add data-testid attributes (2/2 pages lack them)
```

## Portfolio Results

Tested across 4 different site types:

| Site | Type | Pages | Locators | Score | Grade | Key Finding |
|------|------|-------|----------|-------|-------|-------------|
| **Cymbal Bank** | Banking | 2 | 25 | **79** | B | Simple sites score best |
| **Erply** | SaaS/POS | 3 | 502 | **73** | C | 33% locators failing |
| **IMDB** | Media | 3 | ~600 | **65** | D | Heavy xpath reliance |
| **Steam** | Gaming | 4 | 862 | **60** | D | Complex sites struggle |

**Key Insight:** Site complexity inversely correlates with locator quality. Simple, focused applications have better test automation stability than complex, feature-rich platforms.

## v1.3 Updates

### Added
- **Executive summary reports** (`summary.ts`) - Single-site analysis with actionable insights
- **Debug logging system** (`logger.ts`) - Toggle with `DEBUG=true` environment variable
- **Element timeout protection** - 5-second max per element prevents infinite hangs
- **Auto-detection** - Automatically finds latest crawl file
- **Progress tracking** - Real-time feedback during analysis in debug mode

### Fixed
- **Removed hardcoded URLs** - No more IMDB defaults anywhere
- **URL deduplication** - Strips query parameters (`?ref=`, `?utm_source=`)
- **visitedUrls tracking** - Crawl properly saves which pages were actually visited
- **TypeScript strict null handling** - Proper type safety throughout
- **Cookie banner detection** - Expanded from 3 to 11 patterns

### Changed
- **Orchestrate uses visitedUrls** - Analyzes only crawled pages, not all discovered URLs
- **maxPages limit respected** - If crawl visits 5 pages, analysis gets 5 pages
- **Better error messages** - Clear usage instructions when files missing
- **No emoji output** - Professional console formatting

## Development Roadmap

### Version 1.3 (Current - Portfolio Version)
 Static DOM analysis with universal scoring  
 Multi-format reporting (JSON, Markdown, CSV)  
 Executive summaries with actionable recommendations  
 Debug logging and progress tracking  
 URL deduplication and timeout protection  

### Version 2.0 (Planned - Production MVP)
- **Temporal validation** - Weekly rescans to detect breakage
- **ELO rating updates** - Track which locators actually break over time
- **ML model training** - Neural network learns from real-world data
- **Autonomous test generation** - Generate tests from BDD scenarios
- **Self-healing framework** - Auto-swap broken locators

### Version 3.0 (Future - Enterprise)
- **Authentication support** - SSO, SAML, Okta, social logins
- **Anti-bot handling** - Cloudflare, reCAPTCHA bypassing
- **Dynamic content** - Infinite scroll, lazy loading, SPAs
- **CI/CD integration** - GitHub Actions, Jenkins plugins
- **Team collaboration** - Shared reports, role-based access

## System Requirements

- **Node.js** 20.0 or higher
- **RAM** 4GB minimum (8GB recommended for large sites)
- **Disk** 1GB for dependencies + storage for reports
- **Network** Internet connection for browser automation
- **OS** Windows, macOS, or Linux

## Troubleshooting

### Slow Analysis
- Use `--maxPages=5` for faster crawls
- Use `--maxDepth=1` to avoid deep page hierarchies
- Large pages (500+ elements) take 5-10 minutes
- Element timeout (5 sec) prevents infinite hangs

### Missing Reports
- Check `reports/` directory exists
- Verify crawl completed: `cat reports/site.crawl.latest.json`
- Run with `DEBUG=true` to see detailed progress

### TypeScript Errors
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild TypeScript
npx tsc --noEmit
```

### Browser Launch Fails
```bash
# Reinstall Playwright browsers
npx playwright install chromium --force
```

## Contributing

This is a portfolio project demonstrating:
- AI-assisted rapid development (built in 3 days)
- Modern TypeScript/Node.js architecture
- Test automation domain expertise
- Production-ready code quality

## License

MIT License - See LICENSE file for details

## Author

**QA Engineer with 10+ years experience**  
Demonstrating the power of AI-assisted development and deep domain knowledge in test automation.

**Built with:** Claude (Anthropic), TypeScript, Playwright  
**Time to MVP:** 3 days (vs 3-6 months traditional development)  
**Cost:** ~60 EUR (vs 75,000-120,000 EUR for 3-developer team)

---

*Pathfinder - Autonomous Test Locator Intelligence System*  
*Making test automation resilient, one locator at a time.*
