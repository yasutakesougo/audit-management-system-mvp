// ---------------------------------------------------------------------------
// individual-support/types — 共有型 + 定数
// ---------------------------------------------------------------------------
import HealthIcon from '@mui/icons-material/HealthAndSafety';
import InfoIcon from '@mui/icons-material/Info';
import PsychologyIcon from '@mui/icons-material/Psychology';
import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TabValue = 'plan' | 'records';

export interface SupportSection {
  id: string;
  title: string;
  description: string[];
  color: string;
  icon: React.ReactNode;
}

export interface ScheduleSlot {
  id: string;
  time: string;
  activity: string;
  selfTasks: string[];
  supporterTasks: string[];
  isRecorded: boolean;
}

export interface ABCSelection {
  antecedent: string;
  behavior: string;
  consequence: string;
}

export interface SlotFormState {
  mood: string;
  note: string;
  showABC: boolean;
  abc: ABCSelection;
  error: string | null;
}

export interface TimelineEntry {
  id: string;
  time: string;
  activity: string;
  mood: string;
  note: string;
  abc?: ABCSelection;
  recordedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TARGET_NAME = '山田 太郎 様';

export const supportSections: SupportSection[] = [
  {
    id: 'prevention',
    title: '予防的対応（落ち着いている時）',
    description: [
      '朝の挨拶では必ず視線を合わせ、落ち着いた声で伝えます。',
      '活動の切り替え前に「あと5分で次の活動です」と予告します。',
      '安心して過ごせるよう、好きな音楽をバックグラウンドで流します。',
    ],
    color: 'info.light',
    icon: <HealthIcon fontSize="small" sx={{ mr: 1 }} />,
  },
  {
    id: 'skills',
    title: 'スキル獲得支援（行動の置き換え）',
    description: [
      '選択肢を2つ提示し、自分で選べたことを褒めます。',
      '感情カードを使って気持ちを言葉で表現する練習をします。',
      '成功体験を振り返り、自信を高める声掛けを行います。',
    ],
    color: 'success.light',
    icon: <PsychologyIcon fontSize="small" sx={{ mr: 1 }} />,
  },
  {
    id: 'crisis',
    title: '緊急時対応（強いこだわり・パニックの兆候）',
    description: [
      '深呼吸の誘導と静かな声掛けで状況を受け止めます。',
      '安全を確保し、余分な刺激（音・光）を減らします。',
      '落ち着いたら「どうしたかった？」と確認し、再発予防の手立てを検討します。',
    ],
    color: 'warning.light',
    icon: <InfoIcon fontSize="small" sx={{ mr: 1 }} />,
  },
];

export const initialSchedule: ScheduleSlot[] = [
  {
    id: 'slot-0900',
    time: '09:00',
    activity: '朝の会',
    selfTasks: ['朝の挨拶をする', '今日の予定を一緒に確認する'],
    supporterTasks: ['視覚支援ボードを提示する', '落ち着いたトーンで進行をサポートする'],
    isRecorded: false,
  },
  {
    id: 'slot-1000',
    time: '10:00',
    activity: '感覚統合活動',
    selfTasks: ['ボールプールで体を動かす', '5分間のスイングを楽しむ'],
    supporterTasks: ['安全な範囲での動きを見守る', '手順の切り替えを予告する'],
    isRecorded: false,
  },
  {
    id: 'slot-1200',
    time: '12:00',
    activity: '昼食',
    selfTasks: ['自分の席に座り、手を合わせて挨拶する', '好きなおかずから食べ始める'],
    supporterTasks: ['食具の配置を整える', '落ち着いたペースで食べられるよう声掛けする'],
    isRecorded: false,
  },
  {
    id: 'slot-1500',
    time: '15:00',
    activity: '帰りの支度',
    selfTasks: ['持ち物チェックリストを確認する', 'スタッフに今日楽しかったことを伝える'],
    supporterTasks: ['チェックリストを一緒に指差し確認する', '達成したことを振り返りながら褒める'],
    isRecorded: false,
  },
];

export const moodOptions = ['落ち着いている', '楽しそう', '不安そう', '疲れている', 'サインが出ている'];

export const abcOptionMap: Record<keyof ABCSelection, string[]> = {
  antecedent: ['要求が通らない', '活動の切り替え', '感覚刺激が強い', '周囲が騒がしい'],
  behavior: ['手を叩く', '大きな声を出す', 'その場を離れる', '泣く / 叫ぶ'],
  consequence: ['支援者が近づく', '活動から離れる', '要求が受け入れられる', '時間を置いて再開する'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const buildInitialFormState = (schedule: ScheduleSlot[]): Record<string, SlotFormState> => {
  return schedule.reduce<Record<string, SlotFormState>>((acc, slot) => {
    acc[slot.id] = {
      mood: '',
      note: '',
      showABC: false,
      abc: { antecedent: '', behavior: '', consequence: '' },
      error: null,
    };
    return acc;
  }, {});
};
