/**
 * buildSceneNextAction — 場面 × 未処理状態 × 優先度 から次のアクションを導出
 *
 * NextAction の決定ロジックを時計ベースから場面ベースに移行する。
 * 場面遷移時に確認すべきクリティカルアイテムをスタッフに提示する。
 *
 * 優先順位:
 * 1. 未確認の申し送りがあれば最優先（場面に関わらず）
 * 2. 通所受け入れ場面 + 出欠未入力
 * 3. 未記録の利用者がいれば記録を促す
 * 4. すべて完了していれば準備完了
 */
import type { TodayScene } from './todayScene';

export type SceneNextActionPriority = 'critical' | 'high' | 'medium' | 'low';

export type SceneNextActionTarget =
  | 'briefing'
  | 'attendance'
  | 'quick-record'
  | 'user'
  | 'transport'
  | 'service-structure';

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
};

export function buildSceneNextAction(input: SceneNextActionInput): SceneNextAction {
  const criticalUser = input.alertUsers[0];

  // ── P1: 未確認の申し送り → 最優先（場面を問わない）
  if (input.pendingBriefings > 0) {
    return {
      scene: input.scene,
      title: '対応が必要な申し送りがあります',
      description: '場面を切り替える前に申し送りを確認してください',
      reasons: [`未確認の申し送り ${input.pendingBriefings}件`],
      ctaLabel: '確認する',
      ctaTarget: 'briefing',
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

  // ── P4: すべて完了 — 次場面への準備完了
  return {
    scene: input.scene,
    title: '次の場面への準備ができています',
    description: '必要な確認は完了しています',
    reasons: [],
    ctaLabel: '利用者一覧を見る',
    ctaTarget: 'user',
    priority: 'low',
  };
}
