export type UserProcedureDetail = {
  userId: string | number;
  rowNo: number;
  personAction: string;      // 本人の動き
  supporterAction: string;   // 支援者の動き
  condition?: string;        // 留意点・本人の様子の初期文言
};
