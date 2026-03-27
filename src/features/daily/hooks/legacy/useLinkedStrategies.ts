/**
 * useLinkedStrategies — 利用者の現行支援計画シートから戦略テキストを取得する hook
 *
 * daily/support で記録時に「この利用者に対して決まっている戦略」を参照表示するために使う。
 * 読み取り専用。編集は支援計画シート側の責務。
 *
 * 取得ルール:
 *   1. localStorage `planningSheet.versions.v1` から active + isCurrent のシートを特定
 *   2. `planning` フィールド（PlanningDesign）から3種の戦略テキストを返す
 *   3. 各カテゴリ最大 MAX_DISPLAY 件に絞る（UI 膨らみ防止）
 *
 * @see src/domain/isp/schema/ispPlanningSheetSchema.ts — PlanningDesign
 */
import { useEffect, useMemo, useState } from 'react';
import type { SupportPlanningSheet, PlanningDesign } from '@/domain/isp/schema';

// ── 定数 ──

const LS_KEY = 'planningSheet.versions.v1';
/** 各カテゴリの最大表示件数 */
const MAX_DISPLAY = 3;

// ── 返却型 ──

export interface LinkedStrategiesResult {
  /** 先行事象戦略 */
  antecedent: string[];
  /** 教授戦略 */
  teaching: string[];
  /** 後続事象戦略 */
  consequence: string[];
  /** 支援課題の優先順位 */
  priorities: string[];
  /** 戦略の合計件数（全カテゴリ） */
  totalCount: number;
  /** シートが存在するか */
  hasSheet: boolean;
  /** シートID（計画シートへの遷移用） */
  sheetId: string | null;
  /** シートタイトル */
  sheetTitle: string | null;
}

const EMPTY: LinkedStrategiesResult = {
  antecedent: [],
  teaching: [],
  consequence: [],
  priorities: [],
  totalCount: 0,
  hasSheet: false,
  sheetId: null,
  sheetTitle: null,
};

// ── 内部: localStorage からシートを取得 ──

function resolveActiveSheet(userId: string): SupportPlanningSheet | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const all: SupportPlanningSheet[] = JSON.parse(raw);
    // active + isCurrent で最新 version を選ぶ
    let best: SupportPlanningSheet | null = null;
    for (const s of all) {
      if (s.userId !== userId) continue;
      if (s.status !== 'active' || !s.isCurrent) continue;
      if (!best || (s.version ?? 0) > (best.version ?? 0)) {
        best = s;
      }
    }
    return best;
  } catch {
    return null;
  }
}

function extractStrategies(planning: PlanningDesign, sheetId: string, sheetTitle: string): LinkedStrategiesResult {
  const antecedent = (planning.antecedentStrategies ?? []).slice(0, MAX_DISPLAY);
  const teaching = (planning.teachingStrategies ?? []).slice(0, MAX_DISPLAY);
  const consequence = (planning.consequenceStrategies ?? []).slice(0, MAX_DISPLAY);
  const priorities = (planning.supportPriorities ?? []).slice(0, MAX_DISPLAY);
  const totalCount =
    (planning.antecedentStrategies ?? []).length +
    (planning.teachingStrategies ?? []).length +
    (planning.consequenceStrategies ?? []).length;

  return {
    antecedent,
    teaching,
    consequence,
    priorities,
    totalCount,
    hasSheet: true,
    sheetId,
    sheetTitle,
  };
}

// ── Hook ──

export function useLinkedStrategies(userId?: string): LinkedStrategiesResult {
  const [sheet, setSheet] = useState<SupportPlanningSheet | null>(null);

  useEffect(() => {
    if (!userId) {
      setSheet(null);
      return;
    }
    const resolved = resolveActiveSheet(userId);
    setSheet(resolved);
  }, [userId]);

  return useMemo(() => {
    if (!sheet) return EMPTY;
    return extractStrategies(
      sheet.planning,
      sheet.id,
      sheet.title,
    );
  }, [sheet]);
}
