import type { ActionPriority, RawActionSource } from '../models/queue.types';

/**
 * RawActionSource の sourceType に基づいて ActionPriority を決定する。
 *
 * corrective_action の場合は mapper 側で設定された queuePriority を引き継ぐ。
 * これにより、Action Engine の P0/P1/P2 がそのまま Today Queue に反映される。
 */
export function scoreActionPriority(source: RawActionSource): ActionPriority {
  switch (source.sourceType) {
    case 'vital_alert':
      return 'P0';
    case 'incident':
      return 'P1';
    case 'corrective_action': {
      // payload に元の suggestion priority が保持されている
      const payload = source.payload as { queuePriority?: ActionPriority } | undefined;
      return payload?.queuePriority ?? 'P1';
    }
    case 'schedule':
      return 'P2';
    case 'handoff':
      return 'P3';
    case 'exception':
      return 'P1';
    case 'plan_patch': {
      const payload = source.payload as { dueAt?: string } | undefined;
      const dueAt = payload?.dueAt?.slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      return dueAt && dueAt < today ? 'P0' : 'P1';
    }
    case 'isp_renew_suggest':
      return 'P2';
    default: {
      const _exhaustive: never = source.sourceType;
      return _exhaustive;
    }
  }
}
