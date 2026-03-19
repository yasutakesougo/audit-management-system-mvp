/**
 * generateIssueDraft — アラートから GitHub Issue 下書きを生成する pure function
 *
 * KpiAlert + PlaybookEntry から、コピペ可能な構造化 Issue 本文を出力する。
 * 自動起票の前段階として、まず人間が確認→貼り付けできる形を目指す。
 *
 * @see alertPlaybook.ts — プレイブック定義
 * @see computeRoleAlerts.ts — role 別アラート生成
 */

import type { KpiAlert } from './computeCtaKpiDiff';
import type { PlaybookEntry } from './alertPlaybook';

// ── Types ───────────────────────────────────────────────────────────────────

export type IssueDraft = {
  title: string;
  labels: string[];
  body: string;
};

// ── Core Function ───────────────────────────────────────────────────────────

/**
 * KpiAlert と PlaybookEntry から Issue 下書きを生成する
 *
 * - title / labels は PlaybookEntry.issueTemplate から
 * - body は背景・観測値・想定原因・確認ポイント・関連画面を構造化
 */
export function generateIssueDraft(
  alert: KpiAlert,
  playbook: PlaybookEntry,
): IssueDraft {
  const severityEmoji = alert.severity === 'critical' ? '🔴' : '🟡';
  const severityLabel = alert.severity === 'critical' ? 'Critical' : 'Warning';

  const causesBlock = playbook.causes
    .map((c) => `- ${c}`)
    .join('\n');

  const checkpointsBlock = playbook.checkpoints
    .map((c) => `- [ ] ${c}`)
    .join('\n');

  const screensBlock = playbook.relatedScreens
    .map((s) => `- \`${s.path}\` — ${s.label}`)
    .join('\n');

  const body = `## ${severityEmoji} ${severityLabel}: ${alert.label}

### 背景

Telemetry Dashboard のアラートにより自動検出されました。

- **指標値**: ${alert.value}%
- **閾値**: ${alert.threshold}%
- **状態**: ${alert.message}

### 想定原因

${causesBlock}

### 推奨確認ポイント

${checkpointsBlock}

### 関連画面

${screensBlock}

### 備考

- このIssueはTelemetry Dashboard v5のプレイブックから生成されました
- 対応後はTelemetry Dashboardで改善効果を確認してください`;

  return {
    title: playbook.issueTemplate.title,
    labels: playbook.issueTemplate.labels,
    body,
  };
}
