export type ProcedureCategory = 'normal' | 'external';

export type ProcedureRow = {
  rowNo: number;
  timeLabel: string;
  activity: string;
  activityDetail?: string; // 本人の動き / 詳解
  instructionDetail?: string; // 支援者の支援（手順）
  category: ProcedureCategory;
  parentRowNo?: number;
};

/**
 * 原紙（支援手順書兼実施記録）の既定行。
 *
 * daily/support のデフォルト表示は、この時間・活動内容を正本として扱う。
 * 17行構成は src/features/planning-sheet/domain/dailySupportProcedure.ts の
 * OFFICIAL_PROCEDURE_TEMPLATE と同じ行番号・時間・活動内容に揃える。
 */
export const PROCEDURE_ROWS: ProcedureRow[] = [
  { rowNo: 1, timeLabel: '9:30頃', activity: '通所・朝の準備', activityDetail: '手洗い、消毒、荷物をロッカーへ入れる', instructionDetail: '通所時の様子を確認し、必要に応じて声かけ・見守りを行う', category: 'normal' },
  { rowNo: 2, timeLabel: '10:00頃', activity: '体操', activityDetail: '体操に参加する', instructionDetail: '本人の様子を見ながら参加を促す', category: 'normal' },
  { rowNo: 3, timeLabel: '10:10頃', activity: 'スケジュール確認', activityDetail: '一日の予定を確認する', instructionDetail: '本人と一緒に予定を確認し、見通しが持てるよう支援する', category: 'normal' },
  { rowNo: 4, timeLabel: '10:15頃', activity: 'お茶休憩', activityDetail: '手洗い後、お茶を飲む', instructionDetail: 'お茶の準備、片付け、必要に応じた声かけを行う', category: 'normal' },
  { rowNo: 5, timeLabel: '10:20〜12:00', activity: 'AM日中活動', activityDetail: '午前の日中活動に参加する', instructionDetail: '必要に応じて声かけ、見守り、同行支援を行う', category: 'normal' },
  { rowNo: 6, timeLabel: '12:00', activity: '昼食準備', activityDetail: '手洗い、消毒、昼食準備を行う', instructionDetail: '手洗い・消毒・配膳等を見守り、必要に応じて支援する', category: 'normal' },
  { rowNo: 7, timeLabel: '12:10〜12:40', activity: '昼食', activityDetail: '昼食を食べる', instructionDetail: '食事の様子を見守り、必要に応じて声かけ・介助を行う', category: 'normal' },
  { rowNo: 8, timeLabel: '12:40〜13:45', activity: '昼休み', activityDetail: '休憩時間を過ごす', instructionDetail: '休憩中の様子を見守り、必要に応じて声かけを行う', category: 'normal' },
  { rowNo: 9, timeLabel: '13:45', activity: 'スケジュール確認', activityDetail: '午後の予定を確認する', instructionDetail: '本人と一緒に午後の予定を確認する', category: 'normal' },
  { rowNo: 10, timeLabel: '13:45〜14:30', activity: 'PM日中活動', activityDetail: '午後の日中活動に参加する', instructionDetail: '必要に応じて声かけ、見守り、同行支援を行う', category: 'normal' },
  { rowNo: 11, timeLabel: '14:30〜14:45', activity: 'お茶休憩', activityDetail: '手洗い後、お茶を飲む', instructionDetail: 'お茶の準備、片付け、必要に応じた声かけを行う', category: 'normal' },
  { rowNo: 12, timeLabel: '14:45〜15:20', activity: 'PM日中活動', activityDetail: '午後の日中活動に参加する', instructionDetail: '必要に応じて声かけ、見守り、同行支援を行う', category: 'normal' },
  { rowNo: 13, timeLabel: '15:20〜15:40', activity: 'のんびりタイム', activityDetail: '落ち着いて過ごす', instructionDetail: '本人のペースを尊重しながら見守る', category: 'normal' },
  { rowNo: 14, timeLabel: '15:40〜16:00', activity: '帰りの準備', activityDetail: '持ち物確認、帰宅準備を行う', instructionDetail: '持ち物確認や身支度を見守り、必要に応じて支援する', category: 'normal' },
  { rowNo: 15, timeLabel: '16:00', activity: '退所', activityDetail: '退所する', instructionDetail: '退所時の様子を確認し、見送りを行う', category: 'normal' },
  { rowNo: 16, timeLabel: '10:20/13:45〜10:25/13:50', activity: 'AM/PM日中活動（外活動準備）', activityDetail: '外活動に向けた準備を行う', instructionDetail: 'トイレ、帽子、持ち物など外活動に必要な準備を支援する', category: 'external', parentRowNo: 5 },
  { rowNo: 17, timeLabel: '10:25/13:50〜12:00/15:40', activity: 'AM/PM日中活動（外活動）', activityDetail: '外活動に参加する', instructionDetail: '外活動中の安全確認、同行支援、見守りを行う', category: 'external', parentRowNo: 5 },
];

export const NORMAL_PROCEDURE_ROWS = PROCEDURE_ROWS.filter(
  (row) => row.category === 'normal',
);

export const EXTERNAL_PROCEDURE_ROWS = PROCEDURE_ROWS.filter(
  (row) => row.category === 'external',
);

export function getChildProcedureRows(parentRowNo: number): ProcedureRow[] {
  return EXTERNAL_PROCEDURE_ROWS
    .filter((row) => row.parentRowNo === parentRowNo)
    .sort((a, b) => a.rowNo - b.rowNo);
}

/** データの由来を示す型（ProcedureRepository.ts と同期） */
export type ProcedureSource =
  | 'base_steps'
  | 'csv_import'
  | 'planning_sheet';

/** 
 * ScheduleItem の部分型。共通の判定ロジックに使用する 
 */
export type ProcedureStepLike = {
  source?: ProcedureSource;
  sourceStepOrder?: number;
};

/**
 * 業務ルール: 特定の rowNo (sourceStepOrder) は特定の親にぶら下がるオプションである
 */
export const OPTIONAL_CHILD_PARENT_ORDERS = new Map<number, number>([
  [16, 5],
  [17, 5],
]);

/**
 * item が支援計画シート由来かつ「子」として扱うべき行番号か判定する
 */
export function isOptionalChildItem(item: ProcedureStepLike): boolean {
  if (item.source !== 'planning_sheet' || !item.sourceStepOrder) return false;
  return OPTIONAL_CHILD_PARENT_ORDERS.has(item.sourceStepOrder);
}

/**
 * 指定した item の親となる rowNo を取得する
 */
export function getParentOrderForChild(item: ProcedureStepLike): number | null {
  if (item.source !== 'planning_sheet' || !item.sourceStepOrder) return null;
  return OPTIONAL_CHILD_PARENT_ORDERS.get(item.sourceStepOrder) ?? null;
}
