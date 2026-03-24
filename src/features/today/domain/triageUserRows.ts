/**
 * triageUserRows — 利用者リストを複合要因スコアで並べ替える純粋関数
 *
 * スコアリングルール（高い = 優先）:
 *   +100  欠席（absence/preAbsence status）
 *    +80  warning severity のアラート（発熱↑ 等）
 *    +50  未記録（recordFilled = false）
 *    +30  info severity のアラート（戦略実施中 等）
 *    +20  userStatusType あり（遅刻・早退等の登録済みステータス）
 *
 * 同一スコア内では元の配列順序を維持（安定ソート）。
 *
 * ⚠️ UserRow 型を変更しない。
 * ⚠️ 入力配列を破壊しない。
 *
 * @see UserCompactList.tsx — このソートの消費先
 */

import type { UserRow } from '../widgets/UserCompactList';

// ─── Score Weights ───────────────────────────────────────────

/** スコア重みの定義（上位 = 先に対応すべき状態） */
const WEIGHTS = {
  /** 欠席系: 最優先（人員体制に影響） */
  absent: 100,
  /** warning アラート: 発熱↑ などの行動リスク */
  warningAlert: 80,
  /** 未記録: 業務遅延 */
  unfilled: 50,
  /** info アラート: 戦略実施中など */
  infoAlert: 30,
  /** 利用者ステータス登録済み（遅刻・早退等） */
  hasStatus: 20,
} as const;

// ─── Logic ───────────────────────────────────────────────────

/**
 * UserRow のトリアージスコアを計算する。
 * スコアが高い = 優先度が高い。
 */
export function computeTriageScore(user: UserRow): number {
  let score = 0;

  // 欠席
  if (user.status === 'absent') {
    score += WEIGHTS.absent;
  }

  // アラートの severity に応じた加点
  if (user.alerts && user.alerts.length > 0) {
    const hasWarning = user.alerts.some(a => a.severity === 'warning');
    if (hasWarning) {
      score += WEIGHTS.warningAlert;
    } else {
      score += WEIGHTS.infoAlert;
    }
  }

  // 未記録（欠席者は記録不要なのでスキップ）
  if (!user.recordFilled && user.status !== 'absent') {
    score += WEIGHTS.unfilled;
  }

  // 利用者ステータスあり（遅刻・早退等の登録あり）
  if (user.userStatusType) {
    score += WEIGHTS.hasStatus;
  }

  return score;
}

/**
 * UserRow[] を複合トリアージスコアで降順ソートする。
 * 同一スコア内では元の配列順序を維持する（安定ソート）。
 *
 * @param users - ソート前の利用者配列
 * @returns 新しいソート済み配列（元の配列は不変）
 */
export function triageUserRows(users: UserRow[]): UserRow[] {
  return [...users].sort((a, b) => {
    return computeTriageScore(b) - computeTriageScore(a);
  });
}

// ─── Triage Reasons ──────────────────────────────────────────

export type TriageReason = {
  /** 短いラベル（例: "欠席", "未記録", "発熱↑"） */
  label: string;
  /** 視覚的な重要度 */
  severity: 'critical' | 'warning' | 'info';
};

/**
 * UserRow からトリアージ理由タグを生成する。
 * スコアの重み順にタグを並べる（最重要が先頭）。
 * スコア 0 の場合は空配列（理由なし = 通常状態）。
 */
export function buildTriageReasons(user: UserRow): TriageReason[] {
  const reasons: TriageReason[] = [];

  // 欠席
  if (user.status === 'absent') {
    reasons.push({ label: '欠席', severity: 'critical' });
  }

  // warning アラート → 具体的なラベルを使う
  if (user.alerts && user.alerts.length > 0) {
    const warningAlerts = user.alerts.filter(a => a.severity === 'warning');
    if (warningAlerts.length > 0) {
      reasons.push({ label: warningAlerts[0].label, severity: 'warning' });
    } else {
      const infoAlerts = user.alerts.filter(a => a.severity === 'info');
      if (infoAlerts.length > 0) {
        reasons.push({ label: infoAlerts[0].label, severity: 'info' });
      }
    }
  }

  // 未記録
  if (!user.recordFilled && user.status !== 'absent') {
    reasons.push({ label: '未記録', severity: 'warning' });
  }

  // ステータス登録あり
  if (user.userStatusType) {
    const statusLabels: Record<string, string> = {
      absence: '欠席登録',
      preAbsence: '事前欠席',
      late: '遅刻',
      earlyLeave: '早退',
    };
    reasons.push({
      label: statusLabels[user.userStatusType] ?? user.userStatusType,
      severity: 'info',
    });
  }

  return reasons;
}
