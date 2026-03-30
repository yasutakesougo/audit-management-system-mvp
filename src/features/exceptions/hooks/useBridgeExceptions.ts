/**
 * @fileoverview ISP 三層モデル整合性例外の取得 Hook
 *
 * 📌 Wave 2 refactor: useDashboardSummary の直接利用を廃止し、
 * useTodaySummary ファサードを利用するように変更。
 */
import { useTodaySummary } from '@/features/today/domain/useTodaySummary';

export function useBridgeExceptions() {
  const { todayExceptions } = useTodaySummary();

  return {
    exceptions: todayExceptions,
    isLoading: false, // useTodaySummary は Query 同期済み
    refetch: () => { /* useTodaySummary 側の invalidate に委譲 */ }
  };
}
