/**
 * useUserAlerts — Today 利用者カードに表示する直近注意点を取得するフック
 *
 * 責務:
 * - 本日通所予定の全利用者の直近 7日間 ABCRecord を取得
 * - buildUserAlerts() で注意点を算出
 * - userId → UserAlert[] の Map を返す
 *
 * パフォーマンス:
 * - 利用者一覧が変わるまで再取得しない（userIds の安定参照）
 * - 取得は TodayOpsPage マウント時に1回のみ
 * - 読み込み中・エラー時は空の Map を返す（カード描画をブロックしない）
 *
 * @see buildUserAlerts — 純関数（注意点導出）
 * @see UserCompactList   — UI消費先
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBehaviorRepository } from '@/features/daily/infra/behaviorRepositoryFactory';
import type { ABCRecord } from '@/domain/behavior/abc';
import { buildUserAlerts, type UserAlert } from '../domain/buildUserAlerts';

/** アラート取得対象の日数 */
const ALERT_LOOKBACK_DAYS = 7;

export type UseUserAlertsReturn = {
  /** userId → UserAlert[] */
  alertsByUser: Map<string, UserAlert[]>;
  /** ロード中フラグ */
  loading: boolean;
};

/**
 * @param userIds - 本日通所予定の利用者 ID 配列
 */
export function useUserAlerts(userIds: string[]): UseUserAlertsReturn {
  const [allRecords, setAllRecords] = useState<ABCRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // userIds の参照安定化（中身が同じなら再取得しない）
  const prevIdsRef = useRef<string>('');
  const stableIds = useMemo(() => {
    const key = userIds.sort().join(',');
    if (key === prevIdsRef.current) return userIds;
    prevIdsRef.current = key;
    return userIds;
  }, [userIds.sort().join(',')]);

  const fetchAll = useCallback(async () => {
    if (stableIds.length === 0) {
      setAllRecords([]);
      return;
    }

    setLoading(true);
    try {
      const repo = getBehaviorRepository();
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - ALERT_LOOKBACK_DAYS);

      // 並列で全ユーザーの ABCRecord を取得
      const results = await Promise.allSettled(
        stableIds.map((uid) =>
          repo.listByUser(uid, {
            dateRange: {
              from: startDate.toISOString(),
              to: endDate.toISOString(),
            },
            order: 'desc',
            limit: 10, // 1ユーザー最大10件で十分
          }),
        ),
      );

      const merged: ABCRecord[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') {
          merged.push(...r.value);
        }
        // rejected は無視（個別ユーザーのエラーで全体を止めない）
      }

      setAllRecords(merged);
    } catch {
      // 全体エラー → 空のまま（UIをブロックしない）
      setAllRecords([]);
    } finally {
      setLoading(false);
    }
  }, [stableIds]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 純関数で注意点を導出
  const alertsByUser = useMemo(
    () => buildUserAlerts(allRecords).byUser,
    [allRecords],
  );

  return { alertsByUser, loading };
}
