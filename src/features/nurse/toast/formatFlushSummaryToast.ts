import type { FlushSummary } from '@/features/nurse/state/useNurseSync';
import type { SyncSource } from '@/features/nurse/state/useLastSync';

export type SnackbarSeverity = 'success' | 'info' | 'warning' | 'error';

export type FlushToastPayload = {
  message: string;
  severity: SnackbarSeverity;
};

const SOURCE_LABEL: Record<SyncSource, string> = {
  manual: '手動同期',
  online: 'オンライン同期',
  auto: '自動同期',
};

const sourceLabel = (source: SyncSource): string => SOURCE_LABEL[source] ?? '同期';

export const formatFlushSummaryToast = (summary: FlushSummary): FlushToastPayload => {
  const label = sourceLabel(summary.source);
  const ok = summary.okCount;
  const partial = summary.partialCount;
  const error = summary.errorCount;
  const total = summary.totalCount ?? summary.entries.length;
  const bpSent = summary.bpSent ?? 0;
  const durationPart = summary.durationMs > 0 ? ` / ${summary.durationMs}ms` : '';
  const failureIds = summary.failureSamples
    .map((sample) => sample.userId)
    .filter((value, index, self): value is string => Boolean(value) && self.indexOf(value) === index)
    .slice(0, 3);
  const failurePart = failureIds.length > 0 ? `（失敗: ${failureIds.join(', ')}）` : '';

  if (total === 0) {
    return { message: `${label}：対象なし`, severity: 'info' };
  }

  if (error > 0) {
    return {
      message: `${label}：エラー ${error}件（成功 ${ok}件・部分 ${partial}件）${durationPart}${failurePart}`.trim(),
      severity: 'error',
    };
  }

  if (partial > 0 || summary.remaining > 0) {
    const remainingPart = summary.remaining > 0 ? ` / 残り${summary.remaining}件` : '';
    return {
      message: `${label}：一部同期（成功 ${ok}件・部分 ${partial}件）${remainingPart}${durationPart}${failurePart}`.trim(),
      severity: 'warning',
    };
  }

  if (bpSent > 0) {
    return {
      message: `${label}：BP記録を保存しました（${bpSent}件）${durationPart}`.trim(),
      severity: 'success',
    };
  }

  return {
    message: `${label}：全${ok}件を同期しました${durationPart}`.trim(),
    severity: 'success',
  };
};
