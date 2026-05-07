export type UserProcedureDetail = {
  userId: string | number;
  rowNo: number;
  personAction: string;      // 本人の動き
  supporterAction: string;   // 支援者の動き
  condition?: string;        // 留意点・本人の様子の初期文言
};

export type UserProcedureSheetNotes = {
  userId: string | number;
  dailyCarePoints: string;   // 一日を通して気を付ける事
  otherNotes: string;        // その他
};

