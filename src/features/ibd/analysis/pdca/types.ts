export type IcebergPdcaPhase = 'PLAN' | 'DO' | 'CHECK' | 'ACT';

/**
 * 直近のフェーズ変更トレース（フロントメモリ上のみ）
 * SharePointには保存しない軽量監査情報
 */
export type PhaseChangeTrace = {
  from: IcebergPdcaPhase;
  to: IcebergPdcaPhase;
  at: string;   // ISO timestamp
  by: string;   // 変更者名
};

export type IcebergPdcaItem = {
  id: string;
  userId: string;
  /** 紐づく支援計画シートID（optional: 旧データ互換） */
  planningSheetId?: string;
  title: string;
  summary: string;
  phase: IcebergPdcaPhase;
  createdAt: string;
  updatedAt: string;
  /** 検証済みの知見か（分析ボードからの引継ぎ） */
  isValidated?: boolean;
  /** 検証理由・サマリ */
  rationale?: string;
  /** フロントメモリ上のみ — 直近のフェーズ変更トレース */
  lastPhaseChange?: PhaseChangeTrace;
};

// ─────────────────────────────────────────────
// Bridge: IcebergPdcaPhase → PdcaCyclePhase
// ─────────────────────────────────────────────

import type { PdcaCyclePhase } from '@/domain/isp/types';

/**
 * 大文字 IcebergPdcaPhase → 小文字 PdcaCyclePhase の正規化マップ
 *
 * 既存の IcebergPdca UI から統一ドメイン型へ安全に変換する。
 */
const PHASE_NORMALIZE_MAP: Record<IcebergPdcaPhase, PdcaCyclePhase> = {
  PLAN: 'plan',
  DO: 'do',
  CHECK: 'check',
  ACT: 'act',
} as const;

/**
 * IcebergPdcaPhase を PdcaCyclePhase に正規化する。
 *
 * 純関数 — 副作用なし。
 * 万一マップにないキーが渡された場合は 'plan' にフォールバック。
 */
export function normalizePdcaPhase(phase: IcebergPdcaPhase): PdcaCyclePhase {
  return PHASE_NORMALIZE_MAP[phase] ?? 'plan';
}

