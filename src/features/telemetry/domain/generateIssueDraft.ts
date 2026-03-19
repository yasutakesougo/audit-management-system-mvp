/**
 * generateIssueDraft — アラートから GitHub Issue 下書きを生成する pure function
 *
 * KpiAlert + PlaybookEntry から、コピペ可能な構造化 Issue 本文を出力する。
 * v6 で persistenceInfo を追加し、状態・継続情報も本文に含める。
 *
 * @see alertPlaybook.ts — プレイブック定義
 * @see computeAlertPersistence.ts — 持続性情報
 */

import type { KpiAlert } from './computeCtaKpiDiff';
import type { PlaybookEntry } from './alertPlaybook';
import type { AlertPersistence } from './computeAlertPersistence';
import { PERSISTENCE_LABELS, formatPersistenceDuration, formatWorseningStreak } from './computeAlertPersistence';

// ── Types ───────────────────────────────────────────────────────────────────

export type IssueDraftMetadata = {
  alertId: string;
  severity: string;
  role?: string;
  screen?: string;
  currentValue: number;
  threshold: number;
  state?: AlertPersistence['status'];
  consecutivePeriods?: number;
  worseningStreak?: number;
};

export type IssueDraft = {
  title: string;
  labels: string[];
  body: string;
  metadata: IssueDraftMetadata;
};

// ── Core Function ───────────────────────────────────────────────────────────

/**
 * KpiAlert と PlaybookEntry から Issue 下書きを生成する
 *
 * - title / labels は PlaybookEntry.issueTemplate から
 * - body は背景・観測値・想定原因・確認ポイント・関連画面を構造化
 * - persistenceInfo があれば状態・継続情報セクションを追加
 */
export function generateIssueDraft(
  alert: KpiAlert,
  playbook: PlaybookEntry,
  persistenceInfo?: AlertPersistence | null,
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

  // ── 状態・継続情報セクション ──
  let persistenceBlock = '';
  if (persistenceInfo) {
    const stateLabel = PERSISTENCE_LABELS[persistenceInfo.status];
    const duration = formatPersistenceDuration(persistenceInfo.consecutivePeriods);
    const streak = formatWorseningStreak(persistenceInfo.worseningStreak);

    const lines = [
      `- **アラート状態**: ${stateLabel}`,
      `- **継続期間**: ${duration}`,
    ];
    if (streak) {
      lines.push(`- **悪化ストリーク**: ${streak}`);
    }
    if (persistenceInfo.delta !== null) {
      const sign = persistenceInfo.delta >= 0 ? '+' : '';
      lines.push(`- **前期間からの変化**: ${sign}${persistenceInfo.delta}%`);
    }

    persistenceBlock = `\n### アラート状態\n\n${lines.join('\n')}\n`;
  }

  const body = `## ${severityEmoji} ${severityLabel}: ${alert.label}

### 背景

Telemetry Dashboard のアラートにより自動検出されました。

- **指標値**: ${alert.value}%
- **閾値**: ${alert.threshold}%
- **状態**: ${alert.message}
${persistenceBlock}
### 想定原因

${causesBlock}

### 推奨確認ポイント

${checkpointsBlock}

### 関連画面

${screensBlock}

### 備考

- このIssueはTelemetry Dashboard v6のプレイブックから生成されました
- 対応後はTelemetry Dashboardで改善効果を確認してください`;

  // ── metadata 構築 ──
  // role を alert.id から推定（例: "hero-rate-low:staff" → "staff"）
  const colonIdx = alert.id.indexOf(':');
  const role = colonIdx >= 0 ? alert.id.slice(colonIdx + 1) : undefined;

  const metadata: IssueDraftMetadata = {
    alertId: alert.id,
    severity: alert.severity,
    role,
    currentValue: alert.value,
    threshold: alert.threshold,
    state: persistenceInfo?.status,
    consecutivePeriods: persistenceInfo?.consecutivePeriods,
    worseningStreak: persistenceInfo?.worseningStreak,
  };

  return {
    title: playbook.issueTemplate.title,
    labels: playbook.issueTemplate.labels,
    body,
    metadata,
  };
}
