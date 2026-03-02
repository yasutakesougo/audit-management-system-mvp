/**
 * Demo data for NurseHomeDashboard.
 * Extracted from NurseHomeDashboard.tsx.
 * These should be replaced with API calls in production.
 */
import type { InstructionDiff, IntegrationStatus, TaskSeed, TimelineEntry } from './nurseHomeTypes';

export const TASK_SEED: TaskSeed[] = [
  {
    id: 'task-spo2',
    resident: 'I022 中村 裕樹',
    summary: 'SpO2再測定と在宅酸素流量チェック（生活支援員同行）',
    tags: ['バイタル', '酸素療法'],
    priority: 'high',
    dueMinutes: 45,
    recipient: '@生活支援員',
    timelineRef: '09:15 朝の発作記録 / 生活支援員Aと再測定予定',
  },
  {
    id: 'task-med',
    resident: 'I031 佐々木 花',
    summary: '昼食後の服薬確認と嚥下状態の記録を15:00までに共有',
    tags: ['服薬', '申し送り'],
    priority: 'medium',
    dueMinutes: 180,
    recipient: '@次回自分',
    timelineRef: '12:30 服薬 / 生活支援員Bが実施予定',
  },
  {
    id: 'task-wound',
    resident: 'I015 山田 太郎',
    summary: '右足踵の発赤写真を管理者レビュー用にアップロード',
    tags: ['創部観察', '管理者連携'],
    priority: 'medium',
    dueMinutes: 240,
    recipient: '@管理者',
    timelineRef: '14:00 創部処置 / 看護師が対応、管理者レビュー待ち',
  },
  {
    id: 'task-follow',
    resident: 'I022 中村 裕樹',
    summary: '夜間尿量の記録を次回勤務時に確認し、下剤調整結果を判定',
    tags: ['フォローアップ', '生活支援情報'],
    priority: 'low',
    dueMinutes: 720,
    recipient: '@次回自分',
    timelineRef: '20:00 夜間記録 / 生活支援員より共有予定',
  },
];

export const INITIAL_UNREAD: Record<string, boolean> = {
  'task-spo2': true,
  'task-med': true,
  'task-wound': true,
  'task-follow': false,
};

export const TIMELINE: TimelineEntry[] = [
  {
    id: 'timeline-prep',
    phase: '出勤前準備',
    time: '08:20',
    supportLog: '生活支援員A: 排泄介助で便秘訴えを記録',
    nurseFocus: '下剤調整後初日の経過。夜間尿量の共有を@次回自分タグで依頼中。',
    severity: 'warn',
    taskId: 'task-follow',
    tag: '@次回自分',
  },
  {
    id: 'timeline-start',
    phase: '受け持ち開始',
    time: '09:15',
    supportLog: '事業所時間割: 朝の発作記録 (SpO2 89%)',
    nurseFocus: '酸素流量調整を即時確認。生活支援員と再測定タスクを連携。',
    severity: 'danger',
    taskId: 'task-spo2',
    tag: '@生活支援員',
  },
  {
    id: 'timeline-mid',
    phase: 'ケア実施中',
    time: '12:30',
    supportLog: '服薬 (メトグルコ) が未完了ステータス',
    nurseFocus: '嚥下状態ヒアリングをタスク化し、15:00までに共有。',
    severity: 'warn',
    taskId: 'task-med',
    tag: '@次回自分',
  },
  {
    id: 'timeline-handoff',
    phase: '申し送りと退勤',
    time: '14:40',
    supportLog: '創部処置を実施。写真アップロードが保留。',
    nurseFocus: '管理者レビュー用にファイル添付を残タスク化。',
    severity: 'info',
    taskId: 'task-wound',
    tag: '@管理者',
  },
];

export const INSTRUCTION_DIFFS: InstructionDiff[] = [
  {
    id: 'diff-oxygen',
    item: '在宅酸素指示',
    previous: '2L/分 常時',
    updated: '活動時のみ3L/分、安静時は2L/分',
    effective: '本日 10:00',
    note: 'SpO2低下時の再測定結果に応じて流量を調整。',
    priority: 'high',
  },
  {
    id: 'diff-med',
    item: '糖尿病食 + メトグルコ',
    previous: '昼食前に投与',
    updated: '昼食後に変更し、低血糖リスクを軽減',
    effective: '本日 昼食後',
    note: '嚥下状態と血糖推移を15:00までに記録。',
    priority: 'medium',
  },
];

export const INTEGRATION_STATUS: IntegrationStatus[] = [
  {
    id: 'integration-timeline',
    label: '時間割記録リンク',
    detail: '09:15 朝の発作記録 / 生活支援員A のログを参照できます。',
    status: 'ok',
  },
  {
    id: 'integration-followup',
    label: 'フォローアップタスク共有',
    detail: '生活支援員ダッシュボードに2件同期済み。',
    status: 'ok',
  },
  {
    id: 'integration-template',
    label: '医療的ケアテンプレート更新',
    detail: '在宅酸素テンプレートを新指示へ更新待ち。',
    status: 'pending',
  },
  {
    id: 'integration-report',
    label: '終礼レポート転記',
    detail: '高優先タスクが日次終礼レポートに反映済み。',
    status: 'ok',
  },
];
