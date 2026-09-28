/**
 * The only place allowed to write to the console. Debug output is limited to
 * development builds; warnings/errors never include secrets.
 */
/* eslint-disable no-console */
export const logger = {
  debug(...args: unknown[]): void {
    if (__DEV__) console.log('[hopium]', ...args);
  },
  warn(...args: unknown[]): void {
    console.warn('[hopium]', ...args);
  },
  error(...args: unknown[]): void {
    console.error('[hopium]', ...args);
  },
};
