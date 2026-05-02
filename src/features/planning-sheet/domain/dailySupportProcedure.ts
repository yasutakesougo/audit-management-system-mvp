/**
 * dailySupportProcedure.ts — 支援手順書兼実施記録のドメイン定義
 *
 * 原紙（Excel/PDF）との完全なマッピングを保証するためのデータ構造。
 * 画面表示・記録DB・帳票出力のすべてでこの共通構造を使用する。
 */

import type { BridgeSource } from '../planningToRecordBridge';

/**
 * 原紙の明細ブロック区分
 */
export type ProcedureBlock = 'morning' | 'afternoon' | 'outing';

/**
 * 支援手順の1行（原紙の1行に対応）
 */
export type DailySupportProcedureRow = {
  /** 原紙上の通し番号 (1-17) */
  rowNo: number;
  /** ブロック区分 */
  block: ProcedureBlock;
  /** 時間ラベル (例: "9:30頃", "10:20〜12:00") */
  timeLabel: string;
  /** 活動内容 (例: "通所・朝の準備", "AM日中活動") */
  activity: string;
  /** 本人の動き / 手順詳解 */
  personAction: string;
  /** 支援者の動き / 支援手順 */
  supporterAction: string;
  /** 本人の様子 / 留意事項 */
  condition: string;
  /** 特記事項（行ごとのメモ、最終的に帳票下部に集約される場合もある） */
  specialNote: string;
  /** データ由来 */
  bridgeSource?: BridgeSource;
};

/**
 * 原紙（支援手順書兼実施記録）の全体構造
 */
export type DailySupportProcedureDocument = {
  /** タイトル（固定文言: 支援手順書兼実施記録） */
  title: string;
  /** 利用者氏名 (A2) */
  userName: string;
  /** サービス提供日 (A3:Q4) */
  recordDate: string;
  /** 作成者 / 職員氏名 (Y3:AF4) */
  staffName: string;
  /** 明細行 (A:AF) */
  rows: DailySupportProcedureRow[];
  /** 一日を通して気を付ける事 (A28:AF28) */
  dailyCarePoints: string;
  /** その他 (A30:AF30) */
  otherNotes: string;
  /** 特記事項 (A32:AF35) */
  specialNotes: string;
};

/**
 * 原紙の明細行定義（マスター）
 */
export const OFFICIAL_PROCEDURE_TEMPLATE: Omit<DailySupportProcedureRow, 'personAction' | 'supporterAction' | 'condition' | 'specialNote' | 'bridgeSource'>[] = [
  // A. 午前ブロック (Row 7-15)
  { rowNo: 1, block: 'morning', timeLabel: '9:30頃', activity: '通所・朝の準備' },
  { rowNo: 2, block: 'morning', timeLabel: '10:00頃', activity: '体操' },
  { rowNo: 3, block: 'morning', timeLabel: '10:10頃', activity: 'スケジュール確認' },
  { rowNo: 4, block: 'morning', timeLabel: '10:15頃', activity: 'お茶休憩' },
  { rowNo: 5, block: 'morning', timeLabel: '10:20〜12:00', activity: 'AM日中活動' },
  { rowNo: 6, block: 'morning', timeLabel: '12:00', activity: '昼食準備' },
  { rowNo: 7, block: 'morning', timeLabel: '12:10〜12:40', activity: '昼食' },
  { rowNo: 8, block: 'morning', timeLabel: '12:40〜13:45', activity: '昼休み' },
  { rowNo: 9, block: 'morning', timeLabel: '13:45', activity: 'スケジュール確認' },

  // B. 午後ブロック (Row 18-23)
  { rowNo: 10, block: 'afternoon', timeLabel: '13:45〜14:30', activity: 'PM日中活動' },
  { rowNo: 11, block: 'afternoon', timeLabel: '14:30〜14:45', activity: 'お茶休憩' },
  { rowNo: 12, block: 'afternoon', timeLabel: '14:45〜15:20', activity: 'PM日中活動' },
  { rowNo: 13, block: 'afternoon', timeLabel: '15:20〜15:40', activity: 'のんびりタイム' },
  { rowNo: 14, block: 'afternoon', timeLabel: '15:40〜16:00', activity: '帰りの準備' },
  { rowNo: 15, block: 'afternoon', timeLabel: '16:00', activity: '退所' },

  // C. 外出用ブロック (Row 25-26)
  { rowNo: 16, block: 'outing', timeLabel: '10:20/13:45〜10:25/13:50', activity: 'AM/PM日中活動（外活動準備）' },
  { rowNo: 17, block: 'outing', timeLabel: '10:25/13:50〜12:00/15:40', activity: 'AM/PM日中活動（外活動）' },
];
