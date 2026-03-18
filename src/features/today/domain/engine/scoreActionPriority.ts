import type { ActionPriority, RawActionSource } from '../models/queue.types';

export function scoreActionPriority(source: RawActionSource): ActionPriority {
  switch (source.sourceType) {
    case 'vital_alert':
      return 'P0';
    case 'incident':
      return 'P1';
    case 'schedule':
      return 'P2';
    case 'handoff':
      return 'P3';
    default: {
      const _exhaustive: never = source.sourceType;
      return _exhaustive;
    }
  }
}
