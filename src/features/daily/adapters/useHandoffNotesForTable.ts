/**
 * useHandoffNotesForTable — handoff → daily/table adapter
 *
 * @layer adapters
 * @description
 * handoff feature の申し送りデータを daily/table のドメインモデルに変換する
 * adapter hook。feature 境界をまたぐデータ取得・変換はこの層で行い、
 * domain 層や hooks 層には handoff 固有の型を漏らさない。
 *
 * adapter としての責務:
 * 1. handoff feature の useHandoffTimeline を呼び出し
 * 2. 重要度フィルタリング
 * 3. userCode → 特記事項テキスト の Map に変換
 * 4. daily/table が消費しやすい形式（HandoffNotesForTableResult）で返す
 *
 * @see useImportantHandoffsForDaily — 個別記録向け（1人ずつ）
 * @see buildSpecialNotesFromImportantHandoffs — テキスト生成ロジック（共用）
 */

import { useEffect, useMemo, useState } from 'react';
import type { HandoffDayScope, HandoffRecord } from '@/features/handoff/handoffTypes';
import { useHandoffTimeline } from '@/features/handoff/useHandoffTimeline';
import {
  buildSpecialNotesFromImportantHandoffs,
  type ImportantHandoffForDaily,
} from '@/features/handoff/hooks/useImportantHandoffsForDaily';
import { toLocalDateISO } from '@/utils/getNow';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface HandoffNotesForTableResult {
  /** userCode → 特記事項テキスト（重要申し送り分） */
  notesByUser: Map<string, string>;
  /** 申し送りが存在する利用者数 */
  affectedUserCount: number;
  /** 全重要申し送りの件数 */
  totalHandoffCount: number;
  /** loading 状態 */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

/**
 * 一覧形式ケース記録向け — 全利用者の重要申し送りを一括取得
 *
 * @param date 対象日付（YYYY-MM-DD）
 */
export function useHandoffNotesForTable(date: string): HandoffNotesForTableResult {
  const [notesByUser, setNotesByUser] = useState<Map<string, string>>(new Map());
  const [affectedUserCount, setAffectedUserCount] = useState(0);
  const [totalHandoffCount, setTotalHandoffCount] = useState(0);

  // 日付からdayScopeを決定
  const dayScope = useMemo<HandoffDayScope>(() => {
    const today = toLocalDateISO();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (date === today) return 'today';
    if (date === yesterday) return 'yesterday';
    return 'week';
  }, [date]);

  const {
    todayHandoffs: allHandoffs,
    loading,
    error,
  } = useHandoffTimeline('all', dayScope);

  useEffect(() => {
    if (loading || error || !allHandoffs) {
      setNotesByUser(new Map());
      setAffectedUserCount(0);
      setTotalHandoffCount(0);
      return;
    }

    // 重要度「重要」のみを抽出
    const importantHandoffs = allHandoffs.filter(
      (h) => h.severity === '重要',
    );

    if (importantHandoffs.length === 0) {
      setNotesByUser(new Map());
      setAffectedUserCount(0);
      setTotalHandoffCount(0);
      return;
    }

    // userCode ごとにグループ化
    const grouped = new Map<string, HandoffRecord[]>();
    for (const handoff of importantHandoffs) {
      const key = handoff.userCode;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(handoff);
    }

    // 各利用者の申し送りを特記事項テキストに変換
    const result = new Map<string, string>();
    for (const [userCode, handoffs] of grouped) {
      const items: ImportantHandoffForDaily[] = handoffs.map(
        convertToImportantHandoff,
      );
      const text = buildSpecialNotesFromImportantHandoffs(items);
      if (text.trim()) {
        result.set(userCode, text);
      }
    }

    setNotesByUser(result);
    setAffectedUserCount(result.size);
    setTotalHandoffCount(importantHandoffs.length);
  }, [allHandoffs, loading, error]);

  return {
    notesByUser,
    affectedUserCount,
    totalHandoffCount,
    loading,
    error,
  };
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * HandoffRecord → ImportantHandoffForDaily 変換
 * (useImportantHandoffsForDaily 内の同名関数と同等)
 */
function convertToImportantHandoff(
  handoff: HandoffRecord,
): ImportantHandoffForDaily {
  const createdAt = new Date(handoff.createdAt);
  const time = `${createdAt.getHours().toString().padStart(2, '0')}:${createdAt.getMinutes().toString().padStart(2, '0')}`;
  const date = createdAt.toISOString().split('T')[0];

  return {
    id: handoff.id,
    userId: handoff.userCode,
    personDisplayName: handoff.userDisplayName,
    date,
    time,
    category: handoff.category,
    severity: handoff.severity as '通常' | '要注意' | '重要',
    message: handoff.message,
    timeBand: handoff.timeBand,
    status: handoff.status,
  };
}
