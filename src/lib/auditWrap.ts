import { pushAudit } from './audit';

type AuditCtx = {
  actor?: string;
  entity: string;
  baseAction: string; // e.g., 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'
  channel?: 'SPO' | 'MSAL' | 'UI' | 'System';
  before?: Record<string, unknown>;
};

export async function withAudit<T>(ctx: AuditCtx, op: () => Promise<T>): Promise<T> {
  const actor = ctx.actor ?? 'user';
  const channel = ctx.channel ?? 'UI';
  try {
    const result = await op();
    try {
      pushAudit({
        actor,
        action: `${ctx.baseAction}_SUCCESS`,
        entity: ctx.entity,
        channel,
        before: ctx.before,
        after: { result }
      });
    } catch {}
    return result;
  } catch (error) {
    try {
      pushAudit({
        actor,
        action: `${ctx.baseAction}_FAIL`,
        entity: ctx.entity,
        channel,
        before: ctx.before,
        after: { error: error instanceof Error ? error.message : String(error) }
      });
    } catch {}
    throw error;
  }
}

