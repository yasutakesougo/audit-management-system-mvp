/**
 * Phase 3 AI要約 — 型定義
 *
 * AI は分析しない。Phase 1-2 の数値結果を言語化するだけ。
 * この型定義が AI とのインターフェース契約。
 */

// ────────────────────────────────────────────────────────────
// AI への入力 DTO
// ────────────────────────────────────────────────────────────

/** AIに渡すコンテキスト情報 */
export interface HandoffAnalysisContext {
  /** 分析期間ラベル（例: "直近14日"） */
  periodLabel: string;
  /** 事業所名 */
  facilityName: string;
  /** 対象者（朝会/夕会/管理者） */
  audience: 'morning' | 'evening' | 'manager';
}

/**
 * AI要約の入力DTO。
 *
 * Phase 1-2 の計算結果を **集約済みの平坦な構造** で渡す。
 * AI側が再計算する必要がないようにする。
 */
export interface HandoffSummaryInput {
  // ── Phase 1: 基本集計 ──
  /** 対象期間の総件数 */
  totalRecords: number;
  /** 重要かつ未対応の件数 */
  criticalCount: number;
  /** カテゴリ別件数 */
  categoryBreakdown: { category: string; count: number }[];

  // ── Phase 1-A: キーワード ──
  /** 頻出キーワード上位 */
  topKeywords: { keyword: string; count: number }[];

  // ── Phase 1-B: 利用者傾向 ──
  /** 傾向が変化している利用者 */
  trendingUsers: {
    userDisplayName: string;
    recentTrend: 'increasing' | 'stable' | 'decreasing';
    topCategory: string;
    totalMentions: number;
  }[];

  // ── Phase 2-A: アラート ──
  /** 発火済みアラート */
  alerts: {
    label: string;
    severity: string;
    userDisplayName: string;
    suggestion: string;
  }[];

  // ── Phase 2-C: リスクスコア ──
  /** 高リスク利用者 */
  highRiskUsers: {
    userDisplayName: string;
    score: number;
    level: string;
    topSuggestion: string;
  }[];

  // ── コンテキスト ──
  context: HandoffAnalysisContext;
}

// ────────────────────────────────────────────────────────────
// AI からの出力
// ────────────────────────────────────────────────────────────

/** AI要約レポート（正常時） */
export interface HandoffInsightReport {
  /** 全体サマリー（200字以内） */
  summary: string;
  /** 重点確認事項（3件以内） */
  keyPoints: string[];
  /** 推奨アクション（3件以内） */
  suggestedActions: string[];
  /** 利用者別ハイライト */
  userHighlights: {
    userDisplayName: string;
    note: string;
  }[];
  /** AI生成メタデータ */
  meta: {
    generatedAt: string;
    model: string;
    isAiGenerated: true;
  };
}

/** フォールバックレポート（AI失敗時） */
export interface FallbackInsightReport {
  summary: string;
  keyPoints: string[];
  suggestedActions: string[];
  userHighlights: { userDisplayName: string; note: string }[];
  meta: {
    generatedAt: string;
    model: 'fallback';
    isAiGenerated: false;
    reason: string;
  };
}

/** AI要約の出力型（成功 or フォールバック） */
export type InsightReportResult = HandoffInsightReport | FallbackInsightReport;

// ────────────────────────────────────────────────────────────
// 会議要約（将来拡張用）
// ────────────────────────────────────────────────────────────

/** 会議要約レポート */
export interface MeetingSummaryReport {
  /** 会議冒頭の概要（100字以内） */
  opening: string;
  /** 確認必須事項（優先順） */
  mustConfirm: string[];
  /** 利用者別の確認ポイント */
  userNotes: {
    userDisplayName: string;
    note: string;
  }[];
  /** 議題提案 */
  suggestedAgenda: string[];
  /** メタデータ */
  meta: {
    generatedAt: string;
    model: string;
    meetingType: 'morning' | 'evening';
    isAiGenerated: true;
  };
}
