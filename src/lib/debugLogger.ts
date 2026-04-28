import { isDebugFlag } from '@/lib/debugFlag';
import { env } from '@/lib/env';
import { getRuntimeEnv } from '@/lib/env.schema';

type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, ns: string, ...args: unknown[]) {
  const isDebugEnabled = isDebugFlag(env.VITE_AUDIT_DEBUG);
  const mode = getRuntimeEnv()?.MODE;
  // Allow all levels if VITE_AUDIT_DEBUG is enabled, regardless of mode.
  // Otherwise, only show errors in production.
  if (!isDebugEnabled && mode !== 'development' && mode !== 'test' && level !== 'error') return;
  if (!isDebugEnabled && level === 'debug') return;
  (console as unknown as Record<Level, (message?: unknown, ...optionalParams: unknown[]) => void>)[level](`[audit:${ns}]`, ...args);
}

export const auditLog = {
  debug: (ns: string, ...a: unknown[]) => log('debug', ns, ...a),
  info: (ns: string, ...a: unknown[]) => log('info', ns, ...a),
  warn: (ns: string, ...a: unknown[]) => log('warn', ns, ...a),
  error: (ns: string, ...a: unknown[]) => log('error', ns, ...a),
  get enabled() { return isDebugFlag(env.VITE_AUDIT_DEBUG); }
};
