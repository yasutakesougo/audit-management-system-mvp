/**
 * buildSceneNextAction — 場面 × 未処理状態 × 優先度 から次のアクションを導出
 *
 * 場面（Scene）はコンテキスト情報であり、完了対象ではない。
 * 場面に応じて「次に確認すべきアクション」をスタッフに提示する。
 * 場面の遷移は deriveCurrentScene / inferTodayScene が自動判定する。
 *
 * 優先順位:
 * 1. 未確認の申し送りがあれば最優先（場面に関わらず）
 * 2. 通所受け入れ場面 + 出欠未入力
 * 3. 未記録の利用者がいれば記録を促す
 * 4. すべて完了していれば対応済み
 */
import type { TodayScene } from './todayScene';

export type SceneNextActionPriority = 'critical' | 'high' | 'medium' | 'low';

export type SceneNextActionTarget =
  | 'briefing'
  | 'attendance'
  | 'attendance-alert'
  | 'quick-record'
  | 'user'
  | 'transport'
  | 'service-structure'
  | 'exception-action';

export type SceneNextAction = {
  scene: TodayScene;
  title: string;
  description: string;
  reasons: string[];
  ctaLabel: string;
  ctaTarget: SceneNextActionTarget;
  userId?: string;
  priority: SceneNextActionPriority;
};

export type SceneNextActionInput = {
  scene: TodayScene;
  pendingBriefings: number;
  pendingAttendance: number;
  pendingDailyRecords: number;
  alertUsers: { id: string; name: string }[];
  /** ISP 三層モデルの整合性不備 (Exception Bridge) */
  pendingExceptions?: import('@/domain/isp/exceptionBridge').TriggeredException[];
};

export function buildSceneNextAction(input: SceneNextActionInput): SceneNextAction {
  const criticalUser = input.alertUsers[0];

  // ── P0: 重大な例外 (ISP 整合性エラー: Exception Bridge) → 最優先
  // 計画された支援が行われていない、またはリスク確認が漏れている場合に介入する。
  if (input.pendingExceptions && input.pendingExceptions.length > 0) {
    const first = input.pendingExceptions.find(e => e.severity === 'critical') || input.pendingExceptions[0];
    return {
      scene: input.scene,
      title: first.title,
      description: first.suggestedAction,
      reasons: [`支援不備 ${input.pendingExceptions.length}件`, first.category],
      ctaLabel: '今すぐ対応',
      ctaTarget: 'exception-action',
      userId: first.provenance.userId,
      priority: first.severity === 'critical' ? 'critical' : 'high',
    };
  }

  // ── P1: 注意アラート（欠席・発熱等）→ 次点（場面を問わない）
  // briefingAlerts は出席系アラートであり、HandoffPanel の「申し送り」とは別概念。
  if (input.pendingBriefings > 0) {
    return {
      scene: input.scene,
      title: '対応が必要な注意アラートがあります',
      description: '出欠状況を確認してください',
      reasons: [`注意アラート ${input.pendingBriefings}件`],
      ctaLabel: '出欠を確認',
      ctaTarget: 'attendance-alert',
      priority: 'critical',
    };
  }

  // ── P2: 通所受け入れ場面 + 出欠未入力
  if (input.scene === 'arrival-intake' && input.pendingAttendance > 0) {
    return {
      scene: input.scene,
      title: '通所確認を進めてください',
      description: '未入力の出欠があります',
      reasons: [`出欠未入力 ${input.pendingAttendance}件`],
      ctaLabel: '出欠を入力',
      ctaTarget: 'attendance',
      priority: 'high',
    };
  }

  // ── P2.5: day-closing + 未記録 → 本日中に完了必須
  if (input.scene === 'day-closing' && input.pendingDailyRecords > 0) {
    return {
      scene: input.scene,
      title: '本日の記録を完了してください',
      description: `終礼前に記録を完了しましょう。残り ${input.pendingDailyRecords}名`,
      reasons: [`未記録 ${input.pendingDailyRecords}名`],
      ctaLabel: `残り ${input.pendingDailyRecords}名を記録する`,
      ctaTarget: 'quick-record',
      userId: criticalUser?.id,
      priority: 'critical',
    };
  }

  // ── P3: 未記録の利用者
  if (input.pendingDailyRecords > 0) {
    return {
      scene: input.scene,
      title: '日中記録の確認があります',
      description: '未記録の利用者があります',
      reasons: [`未記録 ${input.pendingDailyRecords}件`],
      ctaLabel: '記録を入力する',
      ctaTarget: 'quick-record',
      userId: criticalUser?.id,
      priority: 'high',
    };
  }

  // ── P3.5: day-closing + 全完了 → 本日完了の祝福
  if (input.scene === 'day-closing' && input.pendingDailyRecords === 0
      && input.pendingAttendance === 0) {
    return {
      scene: input.scene,
      title: '🎉 本日の業務を完了しました！',
      description: 'すべての記録と申し送りが完了しています。お疲れさまでした。',
      reasons: [],
      ctaLabel: '利用者一覧を見る',
      ctaTarget: 'user',
      priority: 'low',
    };
  }

  // ── P4: すべて完了 — 対応済み
  return {
    scene: input.scene,
    title: 'すべての対応が完了しています',
    description: '現在、必要な対応はありません',
    reasons: [],
    ctaLabel: '利用者一覧を見る',
    ctaTarget: 'user',
    priority: 'low',
  };
}
