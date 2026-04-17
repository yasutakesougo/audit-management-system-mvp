/**
 * Step 1: List Existence Check
 *
 * Calls checkAllLists() for DAY0-required lists and returns the health summary.
 */
import { checkAllLists, type HealthCheckSummary } from '@/sharepoint/spListHealthCheck';
import { clearSpHealthSignal } from '@/features/sp/health/spHealthSignalStore';
import { SP_LIST_REGISTRY } from '@/sharepoint/spListRegistry';
import { DAY0_REQUIRED_KEYS } from '../constants';
import type { Fetcher } from '../types';

export async function runStep1(
  fetcher: Fetcher,
  appendLog: (msg: string) => void,
): Promise<HealthCheckSummary> {
  appendLog('📋 Step1: リスト存在確認開始...');
  const day0Entries = SP_LIST_REGISTRY.filter(e => DAY0_REQUIRED_KEYS.includes(e.key));
  const result = await checkAllLists(fetcher, day0Entries);
  appendLog(`📋 Step1完了: ${result.ok}/${result.total} OK, ${result.notFound} 未発見, ${result.forbidden} 権限不足`);

  if (result.ok === result.total) {
    appendLog('✅ すべてのリストが正常に確認されたため、接続警告を解除します。');
    clearSpHealthSignal();
  }

  return result;
}
