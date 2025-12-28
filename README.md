# Pathfinder

Autonomous Test Locator Intelligence System

## Overview

Pathfinder analyzes web applications to identify and score DOM locators based on their stability and reliability for automated testing. The system extracts all possible locators for interactive elements, scores them using heuristic analysis, and generates actionable reports for test automation engineers.

## Quick Start

```bash
npm install
npx playwright install chromium
npx ts-node src/pf/scan_locators.ts https://example.com
```

## Architecture

### Core Components

- **types.ts** - TypeScript type definitions and interfaces
- **utils.ts** - Shared utility functions for file I/O and data processing
- **scan_locators.ts** - DOM analysis and locator extraction engine
- **score.ts** - Scoring algorithm with weighted heuristics
- **orchestrate.ts** - Workflow orchestration and batch processing
- **report.ts** - Report generation in multiple formats
- **training_data.ts** - ML training data export functionality
- **crawl.ts** - Web crawler for URL discovery (requires implementation)

### Technology Stack

- TypeScript 5.0+
- Playwright 1.40+ for browser automation
- Node.js 16+ runtime

## Scoring System

Locators receive scores from 0-100 based on:

- Strategy quality (40% weight): testId=100, xpath=20
- Uniqueness (30% weight): Whether the locator uniquely identifies the element
- DOM depth (20% weight): Penalty for deeply nested elements
- Stability factors (10% weight): Dynamic classes, text length, semantic HTML

Letter grades are assigned as follows:
- A: 90-100 (Excellent - highly stable)
- B: 80-89 (Good - safe to use)
- C: 70-79 (Acceptable - monitor for changes)
- D: 60-69 (Risky - consider alternatives)
- F: 0-59 (Dangerous - will likely break)

## Output Formats

### JSON Reports
- Timestamped archives for historical tracking
- Latest snapshot for current state analysis
- Complete locator data with scoring details

### Markdown Summaries
- Human-readable format
- Grade distribution charts
- Top and bottom performers
- Critical issues and recommendations

### CSV Training Data
- Structured format for machine learning
- Includes all scoring dimensions
- ELO ratings for temporal tracking

## Development Roadmap

### Version 1.2 (Current)
- Static DOM analysis
- Heuristic scoring
- Multi-format reporting
- Basic URL crawling

### Version 2.0 (Planned)
- Temporal validation with scheduled rescans
- ELO rating updates based on actual breakage
- Neural network training on collected data
- Autonomous test generation from BDD scenarios

### Version 3.0 (Future)
- Production hardening for enterprise use
- Authentication system support
- Anti-bot measure handling
- Dynamic content processing

## Usage

### Single Page Analysis

```bash
npx ts-node src/pf/scan_locators.ts https://example.com
```

### Batch Processing

```bash
npx ts-node src/pf/crawl.ts https://example.com --maxPages=50
npx ts-node src/pf/orchestrate.ts
```

### Output Location

All reports are saved to the `reports/` directory with both timestamped archives and latest snapshots.

## System Requirements

- Node.js 16.0 or higher
- 4GB RAM minimum
- Internet connection for browser automation
- Disk space for report storage

## License

Proprietary - All rights reserved
