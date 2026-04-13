/**
 * supervisionTracking — 観察義務（2回に1回）ドメインロジック
 *
 * Shadow Model（ibdStore）から責務移植するための純粋関数群。
 */

export interface SupervisionCounter {
  userId: number;
  /** 未観察の支援回数 */
  supportCount: number;
  /** 最終観察日（ISO 8601） */
  lastObservedAt: string | null;
}

export interface SupervisionLogRecord {
  id: string;
  userId: number;
  supervisorId: number;
  observedAt: string;
  notes: string;
  actionsTaken: string[];
  adherenceToManual?: number;
  discoveredPositiveConditions?: string[];
  suggestedProcedureUpdates?: string[];
  pdcaRecommendation?: 'continue' | 'adjust' | 'revise' | 'escalate';
}

export type SupervisionAlertLevel = 'ok' | 'warning' | 'overdue';

export function createInitialSupervisionCounter(
  userId: number,
): SupervisionCounter {
  return {
    userId,
    supportCount: 0,
    lastObservedAt: null,
  };
}

export function incrementSupervisionCounter(
  counter: SupervisionCounter,
): SupervisionCounter {
  return {
    ...counter,
    supportCount: counter.supportCount + 1,
  };
}

export function resetSupervisionCounter(
  counter: SupervisionCounter,
  observedAt: string,
): SupervisionCounter {
  return {
    ...counter,
    supportCount: 0,
    lastObservedAt: observedAt,
  };
}

export function getSupervisionAlertLevel(
  supportCount: number,
): SupervisionAlertLevel {
  if (supportCount >= 2) return 'overdue';
  if (supportCount >= 1) return 'warning';
  return 'ok';
}

export function getSupervisionAlertMessage(supportCount: number): string {
  if (supportCount >= 2) {
    return `観察義務超過: ${supportCount}回の支援が未観察です（基準: 2回に1回以上の観察が必要）`;
  }
  if (supportCount >= 1) {
    return `次回の支援前に実践研修修了者による観察が推奨されます（現在${supportCount}回未観察）`;
  }
  return '';
}
