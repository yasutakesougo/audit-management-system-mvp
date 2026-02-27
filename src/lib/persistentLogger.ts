/**
 * Simple persistent logger using localStorage to help diagnostics on tablets
 * where DevTools are not available.
 */

export interface PersistedError {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  context?: string; // e.g., URL or component name
  isZod?: boolean;
}

const STORAGE_KEY = 'audit_system_error_logs';
const MAX_LOGS = 10;

export const persistentLogger = {
  /**
   * Log an error to localStorage
   */
  error: (err: unknown, context?: string) => {
    try {
      const logs = persistentLogger.getLogs();
      const newError: PersistedError = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        context,
        isZod: (err != null && typeof err === 'object' && (err as { name?: string }).name === 'ZodError')
      };

      logs.unshift(newError);

      // Keep only recent logs
      const trimmed = logs.slice(0, MAX_LOGS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      // Fail silently to avoid infinite error loops
      // eslint-disable-next-line no-console
      console.warn('[persistentLogger] Failed to write to storage:', e);
    }
  },

  /**
   * Retrieve all logs
   */
  getLogs: (): PersistedError[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as PersistedError[];
    } catch {
      return [];
    }
  },

  /**
   * Clear all logs
   */
  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
