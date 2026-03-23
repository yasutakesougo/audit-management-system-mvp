/**
 * useYesterdaySnapshot — 前日のステータススナップショットを localStorage で永続化
 *
 * 仕組み:
 * 1. ページ読み込み時に localStorage から前日のスナップショットを復元
 * 2. 今日のスナップショットを localStorage に保存
 * 3. 日付が変わったら自動的に前日分に切り替わる
 *
 * ストレージキー: `today-status-snapshot-{date}`
 * 保持期間: 今日と前日の2日分のみ保持（古いデータは自動削除）
 *
 * ⚠️ このhookはスナップショットの「保存/取得」のみ。
 *    差分計算は computeStatusDelta の責務。
 */

import { useEffect, useMemo, useRef } from 'react';
import type { DaySnapshot } from '../domain/computeStatusDelta';

const STORAGE_KEY_PREFIX = 'today-status-snapshot-';
const _MAX_DAYS_STORED = 2;

/**
 * 指定日のストレージキーを返す
 */
function storageKey(dateISO: string): string {
  return `${STORAGE_KEY_PREFIX}${dateISO}`;
}

/**
 * 今日の日付を YYYY-MM-DD 形式で返す（テスト可能にするためオプショナル引数あり）
 */
function getToday(now?: Date): string {
  const d = now ?? new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 指定日の前日を YYYY-MM-DD 形式で返す
 */
function getYesterday(todayISO: string): string {
  const d = new Date(todayISO + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 古いスナップショットをクリーンアップする
 */
function cleanupOldSnapshots(todayISO: string, yesterdayISO: string): void {
  try {
    const allowedKeys = new Set([storageKey(todayISO), storageKey(yesterdayISO)]);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX) && !allowedKeys.has(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage unavailable — ignore
  }
}

export type UseYesterdaySnapshotResult = {
  /** 前日のスナップショット。存在しない場合は null */
  yesterday: DaySnapshot | null;
  /** 今日のスナップショットを保存する関数 */
  saveToday: (snapshot: DaySnapshot) => void;
};

/**
 * Hook: 前日のスナップショットを localStorage で管理する。
 *
 * @param now - テスト用の現在日時（省略時は new Date()）
 */
export function useYesterdaySnapshot(now?: Date): UseYesterdaySnapshotResult {
  const todayISO = getToday(now);
  const yesterdayISO = getYesterday(todayISO);

  // 前日データの読み込み（初回のみ）
  const yesterday = useMemo<DaySnapshot | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey(yesterdayISO));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DaySnapshot;
      // 簡易バリデーション
      if (
        typeof parsed.pendingCount !== 'number' ||
        typeof parsed.absenceCount !== 'number' ||
        typeof parsed.feverCount !== 'number' ||
        typeof parsed.urgentCount !== 'number'
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [yesterdayISO]);

  // 古いスナップショットのクリーンアップ（初回のみ）
  const cleanedUp = useRef(false);
  useEffect(() => {
    if (!cleanedUp.current) {
      cleanupOldSnapshots(todayISO, yesterdayISO);
      cleanedUp.current = true;
    }
  }, [todayISO, yesterdayISO]);

  // 今日のスナップショット保存関数（最後に保存した値を記憶して重複保存を防ぐ）
  const lastSavedRef = useRef<string | null>(null);

  const saveToday = useMemo(() => {
    return (snapshot: DaySnapshot) => {
      try {
        const json = JSON.stringify(snapshot);
        // 同じ値なら再保存しない
        if (lastSavedRef.current === json) return;
        localStorage.setItem(storageKey(todayISO), json);
        lastSavedRef.current = json;
      } catch {
        // localStorage unavailable — ignore
      }
    };
  }, [todayISO]);

  return { yesterday, saveToday };
}

// テスト用エクスポート
export { getToday as _getToday, getYesterday as _getYesterday, storageKey as _storageKey, cleanupOldSnapshots as _cleanupOldSnapshots, STORAGE_KEY_PREFIX };
