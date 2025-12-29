// src/pf/logger.ts
// Simple debug logging system with environment variable control
// Future enhancement: Upgrade to full logger with levels (ERROR, WARN, INFO, DEBUG)

const DEBUG = process.env.DEBUG === 'true';

export const logger = {
  /**
   * Log error messages (always shown)
   * In DEBUG mode, includes full stack trace
   */
  error: (msg: string, err?: Error) => {
    console.error(`[ERROR] ${msg}`);
    if (err && DEBUG) {
      console.error(err.stack);
    }
  },

  /**
   * Log informational messages (always shown)
   * Used for normal operation output
   */
  info: (msg: string) => {
    console.log(msg);
  },

  /**
   * Log debug messages (only in DEBUG mode)
   * Usage: DEBUG=true npx ts-node src/pf/crawl.ts <url>
   */
  debug: (msg: string) => {
    if (DEBUG) {
      console.log(`[DEBUG] ${msg}`);
    }
  },

  /**
   * Check if debug mode is enabled
   */
  isDebug: () => DEBUG,
};