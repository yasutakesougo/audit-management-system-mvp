// ---------------------------------------------------------------------------
// loadMagicDemo — ワンクリックで「魔法の3分デモ」用データを完全装填
//
// localStorage と in-memory ストアを一括クリア＆シードし、
// 桂川さんモデルの「完璧な1日」を再現する。
//
// autoLinkBipToProcedures で BIP ↔ 日課を自動クロスリンクし、
// 画面上に 🛡️ 支援プラン チップを表示させる。
// ---------------------------------------------------------------------------

import { INTERVENTION_DRAFT_KEY, type BehaviorInterventionPlan, type UserInterventionPlans } from '@/features/analysis/domain/interventionTypes';
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { EXECUTION_RECORD_KEY, type ExecutionRecord } from '@/features/daily/domain/executionRecordTypes';
import { seedDemoBehaviors } from '@/features/daily/stores/behaviorStore';
import { autoLinkBipToProcedures } from '@/features/import/domain/autoLinkBipToProcedures';

// ---------------------------------------------------------------------------
// Constants — Demo protagonist（桂川さんモデル）
// ---------------------------------------------------------------------------

/** デモの主人公（田中太郎枠を桂川さんとして使用） */
export const DEMO_USER_ID = 'U-001';
export const DEMO_USER_NAME = '田中 太郎';
export const DEMO_DATE = new Date().toISOString().slice(0, 10); // 今日

// ---------------------------------------------------------------------------
// 1. 日課表（ProcedureStore）— 桂川さんの1日スケジュール
// ---------------------------------------------------------------------------

export const RAW_DEMO_PROCEDURES: ScheduleItem[] = [
  { id: 'proc-0930', time: '09:30', activity: '通所・体調チェック', instruction: '笑顔で迎え入れ、体温と顔色を確認する。', isKey: true },
  { id: 'proc-1000', time: '10:00', activity: '体操', instruction: 'ラジオ体操。無理のない範囲で参加を促す。', isKey: false },
  { id: 'proc-1015', time: '10:15', activity: 'お茶休憩', instruction: '空き時間になりやすいので見守り。感覚おもちゃ提供。', isKey: false },
  { id: 'proc-1030', time: '10:30', activity: 'AM日中活動（作業）', instruction: '作業に集中できるよう環境を整える。物品の管理に注意。', isKey: true },
  { id: 'proc-1145', time: '11:45', activity: '昼食準備', instruction: '手洗い・消毒の促し。絵カードで手順を示す。', isKey: false },
  { id: 'proc-1200', time: '12:00', activity: '昼食', instruction: '食事ペースの見守り。好きなものから食べてOK。', isKey: true },
  { id: 'proc-1240', time: '12:40', activity: '昼休み（のんびりタイム）', instruction: '空き時間の過ごし方を見守る。ハンカチ等の確認。感覚おもちゃ。', isKey: true },
  { id: 'proc-1345', time: '13:45', activity: 'PM日中活動（作業）', instruction: '午後の作業。疲れが見えたら早めに休憩。物品の破損に注意。', isKey: true },
  { id: 'proc-1445', time: '14:45', activity: 'お茶休憩', instruction: '空き時間の見守り。皮むき等の自傷行為に注意。', isKey: false },
  { id: 'proc-1515', time: '15:15', activity: '掃除', instruction: '担当場所の掃除を一緒に進める。「きれいになったね」で締め。', isKey: false },
  { id: 'proc-1530', time: '15:30', activity: '帰りの会', instruction: '今日の振り返りと明日の予定の確認。ポジティブなフィードバック。', isKey: true },
  { id: 'proc-1600', time: '16:00', activity: '退所', instruction: '移動前にハンカチ等の持ち物確認をして見送る。', isKey: false },
];

// ---------------------------------------------------------------------------
// 2. BIP（InterventionStore）— 桂川さんの3つの行動対応プラン
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();

export const DEMO_BIPS: BehaviorInterventionPlan[] = [
  {
    id: 'bip-destroy',
    userId: DEMO_USER_ID,
    targetBehavior: '本や物品を破く、壊す',
    targetBehaviorNodeId: 'node-destroy',
    triggerFactors: [
      { label: '手持ち無沙汰・退屈', nodeId: 'node-boredom' },
      { label: '苦手な活動が続く', nodeId: 'node-dislike-activity' },
    ],
    strategies: {
      prevention: '手元に破きやすいものを置かない。作業活動中は見守りを強化する。',
      alternative: '破いても良い紙（新聞紙など）を代替として用意する。',
      reactive: '安全を確保し、静かに別の活動へ誘導する。壊れた物品は本人の前で静かに片付ける。',
    },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'bip-skin-pick',
    userId: DEMO_USER_ID,
    targetBehavior: '指の皮むき',
    targetBehaviorNodeId: 'node-skin-pick',
    triggerFactors: [
      { label: '空き時間（のんびりタイム等）', nodeId: 'node-idle-time' },
      { label: '不安・退屈', nodeId: 'node-anxiety' },
    ],
    strategies: {
      prevention: '空き時間（のんびりタイムやお茶休憩等）に、手持ち無沙汰にならないよう感覚おもちゃを渡す。',
      alternative: 'スクイーズなどの感覚刺激ツールを使用する。手を使う別の活動に切り替え。',
      reactive: '優しく声をかけ、別の手作業（タオル畳み等）に誘う。無理に止めず気をそらす。',
    },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'bip-handkerchief',
    userId: DEMO_USER_ID,
    targetBehavior: 'ハンカチ・ティッシュへの執着',
    targetBehaviorNodeId: 'node-handkerchief',
    triggerFactors: [
      { label: '移動時・切替場面', nodeId: 'node-transition' },
      { label: 'ポケットの中の確認行動', nodeId: 'node-checking' },
    ],
    strategies: {
      prevention: 'ポケットに入れている時は無くさないよう移動時や退所時に定期的に確認・声かけをする。',
      alternative: 'お気に入りのキーホルダーなど、別の持ち歩きアイテムを提案する。',
      reactive: '無理に取り上げず、本人が安心するまで待ってから次の活動へ促す。',
    },
    createdAt: NOW,
    updatedAt: NOW,
  },
];

// ---------------------------------------------------------------------------
// 3. 実施記録（ExecutionStore）— 過去7日 + 今日午前分
// ---------------------------------------------------------------------------

function buildExecutionRecords(
  procedures: ScheduleItem[],
): Record<string, { date: string; userId: string; records: ExecutionRecord[]; updatedAt: string }> {
  const result: Record<string, { date: string; userId: string; records: ExecutionRecord[]; updatedAt: string }> = {};

  // 過去7日の「リアルなパターン」（完了多め、たまに triggered）
  for (let dayOffset = 7; dayOffset >= 1; dayOffset--) {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    const dateStr = d.toISOString().slice(0, 10);
    const key = `${dateStr}::${DEMO_USER_ID}`;

    const records: ExecutionRecord[] = procedures.map((proc, idx) => {
      // リアルなパターン: AM作業と昼休みで行動発動しやすい
      const triggeredSlots = [3, 6]; // AM日中活動 & のんびりタイム
      const isTriggered = triggeredSlots.includes(idx) && dayOffset % 2 === 0;
      const isSkipped = idx === procedures.length - 1 && dayOffset === 5; // 1日だけ早退
      const procId = proc.id ?? `proc-${idx}`;

      return {
        id: `${dateStr}-${DEMO_USER_ID}-${procId}`,
        date: dateStr,
        userId: DEMO_USER_ID,
        scheduleItemId: procId,
        status: isSkipped ? 'skipped' as const : isTriggered ? 'triggered' as const : 'completed' as const,
        triggeredBipIds: isTriggered && idx === 3 ? ['bip-destroy'] : isTriggered && idx === 6 ? ['bip-skin-pick'] : [],
        memo: isTriggered && idx === 3
          ? '作業中に物品を破く行動あり。代替の紙を提供で落ち着いた。'
          : isTriggered && idx === 6
          ? 'のんびりタイム中に皮むき行動あり。感覚おもちゃ提供で代替。'
          : '',
        recordedBy: 'demo-staff',
        recordedAt: new Date(d.getTime() + idx * 3600000).toISOString(),
      };
    });

    result[key] = { date: dateStr, userId: DEMO_USER_ID, records, updatedAt: NOW };
  }

  // 今日: 午前分だけ記録済み（デモで午後を「実演」する余地を残す）
  const todayKey = `${DEMO_DATE}::${DEMO_USER_ID}`;
  const morningSlots = procedures.slice(0, 6); // 09:30〜12:00 の6スロット
  const todayRecords: ExecutionRecord[] = morningSlots.map((proc, idx) => {
    const procId = proc.id ?? `proc-${idx}`;
    return {
    id: `${DEMO_DATE}-${DEMO_USER_ID}-${procId}`,
    date: DEMO_DATE,
    userId: DEMO_USER_ID,
    scheduleItemId: procId,
    status: idx === 3 ? 'triggered' as const : 'completed' as const, // AM日中活動で1回 triggered
    triggeredBipIds: idx === 3 ? ['bip-destroy'] : [],
    memo: idx === 3 ? '作業中に物品を破こうとした。見守り強化で未然に防止。' : '',
    recordedBy: 'demo-staff',
    recordedAt: new Date().toISOString(),
  };
  });

  result[todayKey] = { date: DEMO_DATE, userId: DEMO_USER_ID, records: todayRecords, updatedAt: NOW };

  return result;
}

// ---------------------------------------------------------------------------
// 4. ABC行動記録（BehaviorStore）— 過去30日間の散布データ
//    ※ seedDemoBehaviors() を再利用（既存関数で十分）
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main loader function
// ---------------------------------------------------------------------------

/**
 * 全ストアをクリア＆桂川さんモデルのデモデータを装填する。
 *
 * - autoLinkBipToProcedures で BIP ↔ 日課を自動クロスリンク
 * - localStorage に ExecutionRecords / InterventionPlans を直接書き込み
 * - seedDemoBehaviors で行動記録を散布
 *
 * @returns 装填サマリ + リンク済み procedures
 */
export function loadMagicDemo(): {
  procedures: ScheduleItem[];
  procedureCount: number;
  bips: number;
  executions: number;
  behaviors: number;
} {
  // ---- Auto-Link: BIP ↔ 日課 クロスリンク ----
  const linkedProcedures = autoLinkBipToProcedures(RAW_DEMO_PROCEDURES, DEMO_BIPS);

  // ---- Clear ----
  localStorage.removeItem(EXECUTION_RECORD_KEY);
  localStorage.removeItem(INTERVENTION_DRAFT_KEY);

  // ---- Seed: Execution Records ----
  const execData = buildExecutionRecords(linkedProcedures);
  localStorage.setItem(
    EXECUTION_RECORD_KEY,
    JSON.stringify({ version: 1, data: execData }),
  );

  // ---- Seed: Intervention Plans (BIP) ----
  const bipData: Record<string, UserInterventionPlans> = {
    [DEMO_USER_ID]: {
      userId: DEMO_USER_ID,
      plans: DEMO_BIPS,
      updatedAt: NOW,
    },
  };
  localStorage.setItem(
    INTERVENTION_DRAFT_KEY,
    JSON.stringify({ version: 1, data: bipData }),
  );

  // ---- Seed: Behaviors (via existing seed function) ----
  const behaviorCount = seedDemoBehaviors(DEMO_USER_ID, 30);

  // ---- Summary ----
  const totalExecRecords = Object.values(execData).reduce((sum, d) => sum + d.records.length, 0);

  return {
    procedures: linkedProcedures,
    procedureCount: linkedProcedures.length,
    bips: DEMO_BIPS.length,
    executions: totalExecRecords,
    behaviors: behaviorCount,
  };
}
