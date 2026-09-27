/**
 * logger.js
 *
 * Lightweight logging utility for Counters.
 * Diagnostic logs via log.info() are suppressed by default unless
 * explicitly enabled via URL param (?debug=1 or ?debug=true), localStorage (debug=true),
 * or window.DEBUG = true.
 *
 * Warnings (log.warn) and errors (log.error) always output to the console.
 */

function isDebugEnabled() {
  if (typeof window === 'undefined') return false;
  if (window.DEBUG) return true;
  try {
    const params = new URLSearchParams(window.location.search);
    const debugParam = params.get('debug');
    if (debugParam !== null && debugParam !== '0' && debugParam !== 'false') {
      return true;
    }
    if (
      typeof localStorage !== 'undefined' &&
      (localStorage.getItem('debug') === 'true' ||
        localStorage.getItem('debug') === '1')
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export const log = {
  isDebug: isDebugEnabled,
  info: (...args) => {
    if (isDebugEnabled()) {
      console.log(...args);
    }
  },
  warn: (...args) => {
    console.warn(...args);
  },
  error: (...args) => {
    console.error(...args);
  },
};

if (typeof window !== 'undefined') {
  window.log = log;
}

export default log;
