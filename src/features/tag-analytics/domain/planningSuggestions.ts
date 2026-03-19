/**
 * @fileoverview Phase F3: Planning 示唆生成 — pure domain functions
 * @description
 * トレンドアラートを「支援計画の見直し候補」に変換する。
 *
 * F3-A: 根拠の明示（なぜアラートが出たか）
 * F3-B: Planning 示唆文（何を検討すべきか）
 *
 * UI はこの出力をそのまま並べるだけで良い。
 * 自動入力はしない。説明可能で軽い支援に留める。
 */

import type { TrendAlert, TrendAlertType } from './tagTrendAlerts';

// ─── 型定義 ──────────────────────────────────────────────

/** Planning 示唆1件分 */
export type PlanningSuggestion = {
  /** 元のアラート */
  alert: TrendAlert;
  /** 根拠文（なぜこのアラートが出たか） */
  rationale: string;
  /** 示唆文（支援計画で検討すべきこと） */
  suggestion: string;
  /** 示唆の優先度（1 = 最高） */
  priority: number;
};

// ─── 示唆テンプレート ────────────────────────────────────

/**
 * タグキー → 示唆文のマッピング。
 * 既知タグには具体的な示唆を、不明タグにはジェネリック示唆を返す。
 */
const TAG_SUGGESTIONS: Record<string, string> = {
  // ── 行動系 ──
  panic:     '環境変化・予定変更時の予告方法や安心できる手順の見直しを検討',
  sensory:   '感覚負荷の高い場面の特定と、クールダウンスペースの確保を検討',
  elopement: '安全確保の導線見直しと、離席の前兆に対する早期対応を検討',

  // ── コミュニケーション系 ──
  verbalRequest:  '要求の言語化を促進する場面設定と、成功体験の積み重ねを検討',
  gestureRequest: 'ジェスチャーの意味理解を深めるコミュニケーション支援を検討',
  echolalia:      'エコラリアの機能（要求・自己調整）を分析し、代替手段を検討',

  // ── 生活系 ──
  eating:    '食事場面の環境調整や、好み・拒否パターンの把握を検討',
  toileting: '排泄パターンの記録確認と、声かけタイミングの調整を検討',
  sleeping:  '生活リズム・睡眠環境の見直しと、日中活動量の調整を検討',

  // ── ポジティブ系 ──
  cooperation:    '協力行動が出やすい場面を増やし、成功体験を強化する方針を検討',
  selfRegulation: '自己調整スキルの般化に向けた場面設定と段階的な支援を検討',
  newSkill:       '新しいスキルの定着に向けた練習機会と強化方法を検討',
};

/** 不明タグ用のジェネリック示唆 */
const GENERIC_SUGGESTION = '関連する支援手順や環境設定の見直しを検討';

/**
 * アラート種類ごとの根拠テンプレート
 */
function buildRationale(alert: TrendAlert): string {
  switch (alert.type) {
    case 'spike':
      return `直近で急増しています（前期間比 +${alert.changeRate}%、現在${alert.currentCount}回）`;
    case 'drop':
      return `前期間に${alert.baselineCount}回あった記録が直近は0件です`;
    case 'new':
      return `前期間には記録がなく、直近で${alert.currentCount}回出現しています`;
    default:
      return '';
  }
}

/**
 * アラート種類ごとの優先度ベース値
 * spike は最も優先度が高い
 */
const TYPE_PRIORITY: Record<TrendAlertType, number> = {
  spike: 1,
  drop: 2,
  new: 3,
};

// ─── メインロジック ──────────────────────────────────────

/**
 * トレンドアラートから Planning 示唆を生成する。
 *
 * @param alerts トレンドアラート配列（detectTagTrends の output.all）
 * @returns 優先度順の示唆リスト
 */
export function buildPlanningSuggestions(
  alerts: TrendAlert[],
): PlanningSuggestion[] {
  if (alerts.length === 0) return [];

  return alerts.map((alert) => ({
    alert,
    rationale: buildRationale(alert),
    suggestion: TAG_SUGGESTIONS[alert.tagKey] ?? GENERIC_SUGGESTION,
    priority: TYPE_PRIORITY[alert.type],
  }));
}

/**
 * 示唆をカテゴリ別にグループ化する。
 * Planning 画面で構造的に見せるためのヘルパー。
 */
export function groupSuggestionsByCategory(
  suggestions: PlanningSuggestion[],
): Record<string, PlanningSuggestion[]> {
  const groups: Record<string, PlanningSuggestion[]> = {};

  for (const s of suggestions) {
    const cat = s.alert.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  }

  return groups;
}
