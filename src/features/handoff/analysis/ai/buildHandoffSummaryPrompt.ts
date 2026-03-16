/**
 * Phase 3-B: 申し送りサマリー用プロンプト生成 — Pure Function
 *
 * @description
 * Phase 1-2 の数値結果を Azure OpenAI 向けのプロンプト文字列に変換する。
 *
 * 設計方針:
 * - 外部依存ゼロ（React / fetch / Date.now 不使用）
 * - テスト容易性 100%
 * - プロンプトは「数値の言語化」を依頼するだけ
 * - AI にデータ分析を依頼しない
 */

import type { HandoffSummaryInput } from './aiTypes';

// ────────────────────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────────────────────

/** プロンプトに含めるキーワード数の上限 */
const MAX_KEYWORDS = 5;
/** プロンプトに含めるアラート数の上限 */
const MAX_ALERTS = 5;
/** プロンプトに含める高リスク利用者数の上限 */
const MAX_RISK_USERS = 3;
/** プロンプトに含める増加傾向利用者数の上限 */
const MAX_TRENDING_USERS = 3;

// ────────────────────────────────────────────────────────────
// Audience ラベル変換
// ────────────────────────────────────────────────────────────

const AUDIENCE_LABELS: Record<HandoffSummaryInput['context']['audience'], string> = {
  morning: '朝会',
  evening: '夕会',
  manager: '管理者',
};

// ────────────────────────────────────────────────────────────
// メイン関数
// ────────────────────────────────────────────────────────────

/**
 * Phase 1-2 の数値結果をプロンプト文字列に変換する。
 *
 * @param input Phase 1-2 の集約済み結果
 * @returns Azure OpenAI に送るプロンプト文字列
 *
 * @example
 * ```ts
 * const prompt = buildHandoffSummaryPrompt(input);
 * const response = await aiClient.chat(prompt);
 * ```
 */
export function buildHandoffSummaryPrompt(input: HandoffSummaryInput): string {
  const { context, totalRecords, criticalCount, categoryBreakdown,
          topKeywords, trendingUsers, alerts, highRiskUsers } = input;

  const audienceLabel = AUDIENCE_LABELS[context.audience];

  const sections: string[] = [];

  // ── システム指示 ──
  sections.push(`あなたは福祉事業所の支援品質改善アドバイザーです。

以下の申し送り分析データをもとに、${audienceLabel}向けの簡潔で実用的なサマリーを作成してください。`);

  // ── 出力制約 ──
  sections.push(`## 必ず守ること
- summary は200字以内
- keyPoints は3件以内
- suggestedActions は3件以内
- 専門用語を避け、現場職員が読んでわかる表現
- 具体的なアクション提案を含める
- ネガティブすぎない表現（改善提案として提示）
- 以下のJSON形式のみで返答すること（JSON以外の文字は不要）`);

  // ── 出力JSON形式 ──
  sections.push(`## 出力JSON形式
{
  "summary": "全体の概要（200字以内）",
  "keyPoints": ["確認事項1", "確認事項2"],
  "suggestedActions": ["推奨アクション1", "推奨アクション2"],
  "userHighlights": [
    { "userDisplayName": "利用者名", "note": "確認ポイント" }
  ]
}`);

  // ── 入力データ ──
  const dataLines: string[] = [];

  dataLines.push(`## 入力データ`);
  dataLines.push(`- 事業所: ${context.facilityName}`);
  dataLines.push(`- 期間: ${context.periodLabel}`);
  dataLines.push(`- 総件数: ${totalRecords}件`);
  dataLines.push(`- 重要・未対応: ${criticalCount}件`);

  // カテゴリ分布
  if (categoryBreakdown.length > 0) {
    dataLines.push('');
    dataLines.push('### カテゴリ分布');
    for (const c of categoryBreakdown) {
      dataLines.push(`- ${c.category}: ${c.count}件`);
    }
  }

  // キーワード
  dataLines.push('');
  dataLines.push('### 注目キーワード');
  if (topKeywords.length > 0) {
    for (const k of topKeywords.slice(0, MAX_KEYWORDS)) {
      dataLines.push(`- ${k.keyword}(${k.count}回)`);
    }
  } else {
    dataLines.push('なし');
  }

  // 増加傾向の利用者
  dataLines.push('');
  dataLines.push('### 増加傾向の利用者');
  const increasing = trendingUsers
    .filter(u => u.recentTrend === 'increasing')
    .slice(0, MAX_TRENDING_USERS);
  if (increasing.length > 0) {
    for (const u of increasing) {
      dataLines.push(`- ${u.userDisplayName}: ${u.topCategory}中心、${u.totalMentions}件`);
    }
  } else {
    dataLines.push('なし');
  }

  // アラート
  dataLines.push('');
  dataLines.push(`### アラート（${alerts.length}件）`);
  if (alerts.length > 0) {
    for (const a of alerts.slice(0, MAX_ALERTS)) {
      dataLines.push(`- [${a.severity}] ${a.userDisplayName} — ${a.label}`);
    }
  } else {
    dataLines.push('なし');
  }

  // 高リスク利用者
  dataLines.push('');
  dataLines.push('### 高リスク利用者');
  const riskUsers = highRiskUsers
    .filter(u => u.level === 'critical' || u.level === 'high')
    .slice(0, MAX_RISK_USERS);
  if (riskUsers.length > 0) {
    for (const u of riskUsers) {
      dataLines.push(`- ${u.userDisplayName}: ${u.score}点(${u.level}) — ${u.topSuggestion}`);
    }
  } else {
    dataLines.push('なし');
  }

  sections.push(dataLines.join('\n'));

  return sections.join('\n\n');
}

// ────────────────────────────────────────────────────────────
// 入力DTO ビルダー（Dashboard → AI の変換）
// ────────────────────────────────────────────────────────────

/**
 * HandoffSummaryInput を Phase 1-2 の計算結果から構築する。
 * Dashboard で useMemo 済みの結果をそのまま受け取る。
 */
export function buildSummaryInput(params: {
  totalRecords: number;
  criticalCount: number;
  categoryBreakdown: { category: string; count: number }[];
  topKeywords: { keyword: string; count: number }[];
  trendingUsers: {
    userDisplayName: string;
    recentTrend: 'increasing' | 'stable' | 'decreasing';
    topCategory: string;
    totalMentions: number;
  }[];
  alerts: {
    label: string;
    severity: string;
    userDisplayName: string;
    suggestion: string;
  }[];
  highRiskUsers: {
    userDisplayName: string;
    score: number;
    level: string;
    topSuggestion: string;
  }[];
  context: {
    periodLabel: string;
    facilityName: string;
    audience: 'morning' | 'evening' | 'manager';
  };
}): HandoffSummaryInput {
  return { ...params };
}
