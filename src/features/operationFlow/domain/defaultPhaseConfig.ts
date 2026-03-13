/**
 * defaultPhaseConfig — 福祉事業所の標準的な9フェーズ時間割
 *
 * 現場実態に基づく初期値:
 *   - 常勤出勤    08:30
 *   - 朝会        09:00–09:15
 *   - 通所受入    09:15–10:30 （送迎車到着〜バイタル確認）
 *   - 午前活動    10:30–12:00
 *   - 午後活動    12:00–15:30 （昼食→午後プログラム）
 *   - 退所対応    15:30–16:00 （帰り支度・送迎出発）
 *   - 記録仕上げ  16:00–17:00
 *   - 夕会        17:00–18:00
 *   - 振り返り    18:00–08:30 （日またぎ）
 *
 * 将来的には SharePoint リストから施設ごとの値を読み込み、
 * この配列を置換する形で運用する。
 */

import type { OperationFlowPhaseConfig } from './operationFlowTypes';

/** 標準フェーズ設定（変更不可の readonly 配列） */
export const DEFAULT_PHASE_CONFIG: readonly OperationFlowPhaseConfig[] = [
  {
    phaseKey: 'staff_prep',
    label: '出勤・朝準備',
    startTime: '08:30',
    endTime: '09:00',
    primaryScreen: '/today',
    sortOrder: 0,
  },
  {
    phaseKey: 'morning_briefing',
    label: '朝会',
    startTime: '09:00',
    endTime: '09:15',
    primaryScreen: '/handoff-timeline',
    sortOrder: 1,
  },
  {
    phaseKey: 'arrival_intake',
    label: '通所受入',
    startTime: '09:15',
    endTime: '10:30',
    primaryScreen: '/daily/attendance',
    sortOrder: 2,
  },
  {
    phaseKey: 'am_activity',
    label: '午前活動',
    startTime: '10:30',
    endTime: '12:00',
    primaryScreen: '/today',
    sortOrder: 3,
  },
  {
    phaseKey: 'pm_activity',
    label: '午後活動',
    startTime: '12:00',
    endTime: '15:30',
    primaryScreen: '/daily',
    sortOrder: 4,
  },
  {
    phaseKey: 'departure_support',
    label: '退所対応',
    startTime: '15:30',
    endTime: '16:00',
    primaryScreen: '/daily/attendance',
    sortOrder: 5,
  },
  {
    phaseKey: 'record_wrapup',
    label: '記録仕上げ',
    startTime: '16:00',
    endTime: '17:00',
    primaryScreen: '/daily',
    sortOrder: 6,
  },
  {
    phaseKey: 'evening_briefing',
    label: '夕会',
    startTime: '17:00',
    endTime: '18:00',
    primaryScreen: '/handoff-timeline',
    sortOrder: 7,
  },
  {
    phaseKey: 'after_hours_review',
    label: '振り返り・翌日準備',
    startTime: '18:00',
    endTime: '08:30',   // 日またぎ — endTime < startTime
    primaryScreen: '/dashboard',
    sortOrder: 8,
  },
] as const;
