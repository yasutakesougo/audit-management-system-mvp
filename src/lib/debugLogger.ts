const enabled = import.meta.env.VITE_AUDIT_DEBUG === '1' || import.meta.env.VITE_AUDIT_DEBUG === 'true';

type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, ns: string, ...args: unknown[]) {
  if (!enabled && level === 'debug') return;
  // eslint-disable-next-line no-console
  (console as any)[level](`[audit:${ns}]`, ...args);
}

export const auditLog = {
  debug: (ns: string, ...a: unknown[]) => log('debug', ns, ...a),
  info: (ns: string, ...a: unknown[]) => log('info', ns, ...a),
  warn: (ns: string, ...a: unknown[]) => log('warn', ns, ...a),
  error: (ns: string, ...a: unknown[]) => log('error', ns, ...a),
  enabled
};
