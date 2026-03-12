/**
 * Iceberg Evidence Adapter — PDCA分析結果をモニタリング評価文の根拠に変換
 *
 * MonitoringEvidenceSection の Daily 記録版 (monitoringEvidenceAdapter.ts) と
 * 同じパターンで Iceberg PDCA の分析結果を引用可能に整形する。
 *
 * @module features/ibd/analysis/pdca/icebergEvidenceAdapter
 */

import type { IcebergPdcaItem } from './types';

// ── Types ──

export interface IcebergEvidence {
  userId: string;
  /** ACT フェーズ優先でソートされた PDCA アイテム */
  items: IcebergPdcaItem[];
  /** 引用候補の件数（ACT フェーズのみ） */
  actCount: number;
  /** 全件数 */
  totalCount: number;
  /** UI 表示用の箇条書き */
  bullets: string[];
  /** コピー用フォーマット済みテキスト */
  text: string;
}

// ── Phase label map ──

const PHASE_LABELS: Record<string, string> = {
  PLAN: '計画',
  DO: '実行',
  CHECK: '評価',
  ACT: '改善',
};

// ── Formatting ──

const formatItem = (item: IcebergPdcaItem): string => {
  const phaseLabel = PHASE_LABELS[item.phase] ?? item.phase;
  const date = item.updatedAt.split('T')[0] ?? item.updatedAt;
  const summary = item.summary?.trim() ? ` — ${item.summary.trim()}` : '';
  return `[${phaseLabel}] ${item.title}${summary} (${date})`;
};

// ── Builder ──

export const buildIcebergEvidence = (args: {
  userId: string;
  items: IcebergPdcaItem[];
}): IcebergEvidence => {
  const { userId, items } = args;

  // ACT フェーズ優先でソート（ACT > CHECK > DO > PLAN）
  const phaseOrder: Record<string, number> = { ACT: 0, CHECK: 1, DO: 2, PLAN: 3 };
  const sorted = [...items].sort(
    (a, b) => (phaseOrder[a.phase] ?? 9) - (phaseOrder[b.phase] ?? 9),
  );

  const actItems = sorted.filter((i) => i.phase === 'ACT');
  const bullets = sorted.map(formatItem);

  const header = `--- Iceberg PDCA Evidence (user=${userId}, items=${items.length}) ---`;
  const footer = `--- End of Iceberg Evidence ---`;
  const text = [header, ...bullets.map((b) => `- ${b}`), footer].join('\n');

  return {
    userId: String(userId),
    items: sorted,
    actCount: actItems.length,
    totalCount: items.length,
    bullets,
    text,
  };
};
