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


export const PROCEDURE_ROWS: ProcedureRow[] = [
  { rowNo: 1, timeLabel: '９：４０頃', activity: '通所、朝の準備', activityDetail: '手洗い、消毒、荷物をロッカーへ', instructionDetail: '提出物を職員に', category: 'normal' },
  { rowNo: 2, timeLabel: '１０：００頃', activity: '朝の本人のルーティン、体操', activityDetail: '第二、事務所のゴミ確認、第二で読書、ラジオ体操', instructionDetail: '必要に応じてゴミ確認の声かけ', category: 'normal' },
  { rowNo: 3, timeLabel: '１０：１０頃', activity: 'スケジュール確認', activityDetail: 'ホワイトボードを指さして確認する', instructionDetail: '同行し、本人と共に指さし確認', category: 'normal' },
  { rowNo: 4, timeLabel: '１０：１５頃', activity: 'お茶休憩', activityDetail: '手洗い後、お茶を飲む', instructionDetail: 'お茶の準備、片付け', category: 'normal' },
  { rowNo: 5, timeLabel: '１０：２０～１２：００', activity: 'AM日中活動', activityDetail: '日中活動準備、タオル作業、紙切り', instructionDetail: '必要に応じて声かけ、見守り、同行支援', category: 'normal' },
  { rowNo: 6, timeLabel: '１２：００', activity: '昼食準備', activityDetail: '手洗い、消毒、検温、配膳', instructionDetail: '検温入力、配膳、食薬準備', category: 'normal' },
  { rowNo: 7, timeLabel: '１２：１０～１２：４０', activity: '昼食', activityDetail: '咀嚼や、食べるスピードに気を付けて食べる', instructionDetail: '必要に応じて声かけ。食後の服薬介助、片付け', category: 'normal' },
  { rowNo: 8, timeLabel: '１２：４０～１３：４５', activity: '昼休み、歯磨き', activityDetail: '歯磨き。自由時間（読書や、多目的室でのんびり過ごす等）', instructionDetail: '歯磨き見守り、声かけ。', category: 'normal' },
  { rowNo: 9, timeLabel: '１３：４５～１３：５０', activity: 'スケジュール確認', activityDetail: 'ホワイトボードを指さして確認する', instructionDetail: '同行し、本人と共に指さし確認', category: 'normal' },
  { rowNo: 10, timeLabel: '１３：５０～１４：３０', activity: 'PM日中活動', activityDetail: '日中活動準備、紙切り、その他', instructionDetail: '必要に応じて声かけ、見守り、同行支援', category: 'normal' },
  { rowNo: 11, timeLabel: '１４：３０～１４：４５', activity: 'お茶休憩', activityDetail: '手洗い後、お茶を飲む', instructionDetail: 'お茶の準備、片付け', category: 'normal' },
  { rowNo: 12, timeLabel: '１４：４５～１５：２０', activity: 'PM日中活動', activityDetail: '日中活動、片付け、掃除、振り返り', instructionDetail: '必要に応じて声かけ、明日のスケジュール確認。帰宅準備の声かけ', category: 'normal' },
  { rowNo: 13, timeLabel: '１５：２０', activity: 'トイレ', activityDetail: 'トイレ、身支度', instructionDetail: '見守り、声かけ', category: 'normal' },
  { rowNo: 14, timeLabel: '１５：３０', activity: '降所準備', activityDetail: '持ち物確認', instructionDetail: '送迎車へ誘導', category: 'normal' },
  { rowNo: 15, timeLabel: '１６：００', activity: '退所', activityDetail: '送迎車にて帰宅', instructionDetail: '見送り', category: 'normal' },
  // 外活動オプション（条件によって表示・非表示を切り替える）
  { rowNo: 16, timeLabel: '１６：３０', activity: 'AM日中活動（外活動準備）', activityDetail: 'トイレに行く、必要に応じて帽子などを準備', instructionDetail: '見守り、準備の声かけ', category: 'external', parentRowNo: 5 },
  { rowNo: 17, timeLabel: '１７：００', activity: 'AM日中活動（外活動）', activityDetail: '外活動に参加する', instructionDetail: '同行支援', category: 'external', parentRowNo: 5 },
  { rowNo: 18, timeLabel: '１７：３０', activity: 'PM日中活動（外活動準備）', activityDetail: 'トイレに行く、必要に応じて帽子などを準備', instructionDetail: '見守り、準備の声かけ', category: 'external', parentRowNo: 10 },
  { rowNo: 19, timeLabel: '１８：００', activity: 'PM日中活動（外活動）', activityDetail: '外活動に参加する', instructionDetail: '同行支援', category: 'external', parentRowNo: 10 },
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
  [18, 10],
  [19, 10],
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

