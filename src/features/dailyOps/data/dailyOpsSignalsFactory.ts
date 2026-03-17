import { shouldSkipSharePoint } from '@/lib/env';
import type { DailyOpsSignalsPort } from './port';
import { makeSharePointDailyOpsSignalsPort } from './sharePointAdapter';

/**
 * Demo/E2E mode: empty in-memory port that never hits external APIs.
 */
const makeDemoPort = (): DailyOpsSignalsPort => ({
  listByDate: async () => [],
  upsert: async () => ({
    id: 1,
    title: 'Demo',
    date: '',
    targetType: 'User',
    targetId: '',
    kind: 'Other',
    time: '',
    summary: '',
    status: 'Active',
    source: 'Other',
    createdAt: '',
    updatedAt: '',
  }),
  setStatus: async () => {},
});

/**
 * Factory: 環境に応じた DailyOpsSignalsPort を生成する。
 *
 * - shouldSkipSharePoint() === true → in-memory demo port
 * - otherwise → SharePoint adapter
 *
 * 環境判定はこの factory 層の正当な責務。
 * UI / Hook 層で shouldSkipSharePoint() を直接呼ばないこと。
 */
export function createDailyOpsSignalsPort(
  acquireToken: (resource?: string) => Promise<string | null>,
): DailyOpsSignalsPort {
  if (shouldSkipSharePoint()) {
    return makeDemoPort();
  }
  return makeSharePointDailyOpsSignalsPort(acquireToken);
}
