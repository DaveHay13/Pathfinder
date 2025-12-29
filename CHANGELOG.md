# Changelog

All notable changes to Pathfinder will be documented in this file.

## [1.3.0] - 2024-12-29

### Added
- **Executive summary reports** (`summary.ts`) - Single-site analysis with:
  - Health status assessment (GOOD/FAIR/POOR)
  - Grade distribution visualization
  - Critical issues and quick wins
  - Page-by-page breakdown with recommendations
  - Locator strategy analysis
  - Prioritized action items
- **Debug logging system** (`logger.ts`) - Environment variable control:
  - `DEBUG=true` enables verbose output
  - Progress tracking for large pages
  - Stack traces in debug mode
  - Structured logging (INFO/ERROR/DEBUG levels)
- **Element timeout protection** - 5-second max per element:
  - Prevents infinite hangs on complex elements
  - Skipped element counter
  - Progress indicators every 100 elements
- **Auto-detection of crawl files** - `orchestrate.ts` finds latest automatically
- **Progress tracking** - Real-time feedback during analysis

### Fixed
- **Removed hardcoded IMDB URLs** from:
  - `scan_locators.ts` line 380
  - `orchestrate.ts` default crawl path
  - All files now require explicit URLs or auto-detect
- **URL deduplication** - Strips query parameters and fragments:
  - `example.com/?ref=1` and `example.com/?ref=2` → `example.com/`
  - Prevents duplicate page analysis
- **visitedUrls tracking** - `crawl.ts` now saves visitedUrls array:
  - Orchestrate uses visitedUrls instead of discoveredUrls
  - Respects maxPages limit correctly
- **TypeScript strict null handling**:
  - Fixed "string | null not assignable to string | undefined"
  - Proper null checks before variable assignment
  - Removed implicit any types
- **Cookie banner detection** - Expanded from 3 to 11 patterns:
  - "Accept all", "Allow all", "I agree"
  - aria-label and class-based selectors
  - More reliable automated consent handling

### Changed
- **Orchestrate behavior** - Uses visitedUrls from crawl:
  - Previously: Analyzed all discoveredUrls
  - Now: Analyzes only visitedUrls (actually crawled pages)
  - maxPages in crawl now correctly limits analysis
- **Error messages** - Clearer usage instructions:
  - Shows example commands when files missing
  - Suggests enabling tools when needed
  - Better troubleshooting guidance
- **Console output** - Professional formatting:
  - Removed all emoji characters
  - Cleaner progress indicators
  - Consistent [N/M] format for progress
- **Crawl report structure** - Added visitedUrls field:
```json