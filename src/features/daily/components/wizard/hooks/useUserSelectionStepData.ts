import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { SupportPlanningSheet } from '@/domain/isp/schema';
import { useAbcRecordRepository } from '@/infra/abc/useAbcRecordRepository';
import { useEffect, useState } from 'react';

export interface AbcSummary {
  /** 利用者ごとの今日の件数 */
  todayCounts: Map<string, number>;
  /** 利用者ごとの最新記録日 */
  latestDates: Map<string, string>;
}

export function useAbcSummary(): AbcSummary {
  const abcRecordRepo = useAbcRecordRepository();
  const [summary, setSummary] = useState<AbcSummary>({
    todayCounts: new Map(),
    latestDates: new Map(),
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all: AbcRecord[] = await abcRecordRepo.getAll();
        const today = new Date().toISOString().slice(0, 10);
        const todayCounts = new Map<string, number>();
        const latestDates = new Map<string, string>();

        for (const r of all) {
          // 今日の件数
          if (r.occurredAt.slice(0, 10) === today) {
            todayCounts.set(r.userId, (todayCounts.get(r.userId) ?? 0) + 1);
          }
          // 最新記録日
          const existing = latestDates.get(r.userId);
          if (!existing || r.occurredAt > existing) {
            latestDates.set(r.userId, r.occurredAt);
          }
        }
        if (mounted) setSummary({ todayCounts, latestDates });
      } catch {
        // localStorage 読み込み失敗は無視
      }
    })();
    return () => {
      mounted = false;
    };
  }, [abcRecordRepo]);

  return summary;
}

export function usePlanningSheetStatus(): Map<string, SupportPlanningSheet> {
  const [sheets, setSheets] = useState<Map<string, SupportPlanningSheet>>(new Map());

  useEffect(() => {
    let mounted = true;
    try {
      const raw = localStorage.getItem('planningSheet.versions.v1');
      if (!raw) return;
      const all: SupportPlanningSheet[] = JSON.parse(raw);
      const map = new Map<string, SupportPlanningSheet>();
      // 各ユーザーの最新の active 版を取得
      for (const s of all) {
        if (s.status === 'active' && s.isCurrent) {
          const existing = map.get(s.userId);
          if (!existing || s.version > (existing.version ?? 0)) {
            map.set(s.userId, s);
          }
        }
      }
      if (mounted) setSheets(map);
    } catch {
      // ignore
    }
    return () => {
      mounted = false;
    };
  }, []);

  return sheets;
}

export function useUserSelectionStepData() {
  const abcSummary = useAbcSummary();
  const planningSheets = usePlanningSheetStatus();

  return {
    abcSummary,
    planningSheets,
  };
}
