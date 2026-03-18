// ---------------------------------------------------------------------------
// useLatestBehaviorMonitoring — 直近の行動モニタリング記録 (L2) を取得する hook
//
// 取得パイプライン:
//   MonitoringMeetingRepository.listByUser(userId)
//     → meetingDate 降順で直近1件を選出
//     → adaptMeetingToBehavior() で BehaviorMonitoringRecord に変換
//     → { record, isLoading, error } を返す
//
// 「最新」の定義: meetingDate (会議実施日) の降順。
// 福祉実務では会議日ベースが自然であり、recordedAt (入力日) ではない。
//
// @see src/domain/isp/behaviorMonitoring.ts
// @see src/domain/isp/monitoringMeeting.ts
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';

import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';
import { adaptMeetingToBehavior } from '@/domain/isp/behaviorMonitoring';
import type { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import type { MonitoringMeetingRepository } from '@/domain/isp/monitoringMeetingRepository';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseLatestBehaviorMonitoringResult {
  /** 直近の行動モニタリング記録。記録なし or userId 未指定時は null */
  record: BehaviorMonitoringRecord | null;
  /** 取得中フラグ */
  isLoading: boolean;
  /** 取得失敗時のエラー */
  error: Error | null;
  /** 手動で再取得するためのコールバック */
  refetch: () => void;
}

export interface UseLatestBehaviorMonitoringOptions {
  /** モニタリング会議リポジトリ（DI で差し替え可能） */
  repository: MonitoringMeetingRepository;
  /** 新規作成時は 'new'、既存シートは planningSheetId を渡す */
  planningSheetId?: string;
}

// ---------------------------------------------------------------------------
// Helper: 直近1件を meetingDate 降順で選出
// ---------------------------------------------------------------------------

function pickLatest(
  records: MonitoringMeetingRecord[],
): MonitoringMeetingRecord | null {
  if (records.length === 0) return null;

  // meetingDate (ISO 8601 date string) で降順ソートし先頭を返す
  const sorted = [...records].sort(
    (a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime(),
  );
  return sorted[0];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLatestBehaviorMonitoring(
  userId: string | null | undefined,
  options: UseLatestBehaviorMonitoringOptions,
): UseLatestBehaviorMonitoringResult {
  const { repository, planningSheetId = 'new' } = options;

  const [record, setRecord] = useState<BehaviorMonitoringRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLatest = useCallback(async () => {
    // userId が無ければ取得しない
    if (!userId) {
      setRecord(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const meetings = await repository.listByUser(userId);
      const latest = pickLatest(meetings);

      if (!latest) {
        setRecord(null);
      } else {
        const behaviorRecord = adaptMeetingToBehavior(latest, planningSheetId);
        setRecord(behaviorRecord);
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      setRecord(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId, repository, planningSheetId]);

  // userId / repository が変わったら再取得
  useEffect(() => {
    void fetchLatest();
  }, [fetchLatest]);

  return { record, isLoading, error, refetch: fetchLatest };
}
