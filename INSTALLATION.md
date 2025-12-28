# Installation Guide

## Prerequisites

Verify the following software is installed on your system:

- Node.js version 16.0 or higher
- npm (included with Node.js)
- Git (optional, for version control)

Check versions:
```bash
node --version
npm --version
```

## Installation Steps

### 1. Project Setup

Copy all project files to your desired directory:
```
C:\Users\91910\Pathfinder\
```

### 2. Install Dependencies

Open a terminal in the project directory and run:

```bash
npm install
```

This will install:
- Playwright for browser automation
- TypeScript compiler and type definitions
- ts-node for TypeScript execution

### 3. Install Browser

Install Chromium browser for Playwright:

```bash
npx playwright install chromium
```

### 4. Verify Installation

Test the scanner on a simple website:

```bash
npx ts-node src\pf\scan_locators.ts https://example.com
```

Expected output: JSON data containing locator information and statistics.

## Directory Structure

After installation, your project should have the following structure:

```
Pathfinder/
├── src/
│   └── pf/
│       ├── types.ts
│       ├── utils.ts
│       ├── scan_locators.ts
│       ├── score.ts
│       ├── orchestrate.ts
│       ├── report.ts
│       ├── training_data.ts
│       └── crawl.ts
├── reports/          (created automatically)
├── node_modules/     (created by npm install)
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

## Troubleshooting

### Module Not Found

If you encounter "Cannot find module" errors:

```bash
npm install
```

### Playwright Installation Issues

If browser installation fails:

```bash
npx playwright install --force chromium
```

### TypeScript Compilation Errors

Verify TypeScript is correctly installed:

```bash
npx tsc --version
```

If errors persist, reinstall dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Path Issues on Windows

Use backslashes for Windows paths:
```bash
npx ts-node src\pf\scan_locators.ts
```

Or forward slashes (also compatible):
```bash
npx ts-node src/pf/scan_locators.ts
```

## Validation

Run these commands to verify installation:

### Check TypeScript Compilation
```bash
npx tsc --noEmit
```
Should complete with no errors.

### Test Scanner
```bash
npx ts-node src/pf/scan_locators.ts https://www.github.com
```
Should output JSON with locator data.

### Verify File Structure
Confirm the `src/pf/` directory exists (not `src/r2d2/`).

## Next Steps

After successful installation:

1. Review README.md for system overview
2. Test the scanner on multiple websites
3. Examine the JSON output structure
4. Review the scoring methodology in score.ts
5. Implement the full crawler in crawl.ts (currently a stub)

## System Requirements

- Operating System: Windows 10+, macOS 10.15+, or Linux
- Memory: 4GB RAM minimum
- Disk Space: 500MB for dependencies and browsers
- Network: Internet connection required for browser automation

## Support

For installation issues:

1. Verify all prerequisites are met
2. Check the troubleshooting section
3. Ensure file paths use the correct folder name (`pf` not `r2d2`)
4. Confirm Node.js version compatibility
