// ---------------------------------------------------------------------------
// CSV Import Types — CSV行の中間型定義
//
// SharePoint リストからエクスポートされた CSV のカラムに準拠。
// SP内部名ではなく、CSVヘッダーの表示名（日本語）を使用。
// ---------------------------------------------------------------------------

/**
 * SupportTemplate CSV の1行
 *
 * CSVヘッダー: "タイトル","UserCode","RowNo","時間帯","活動内容","本人の動き","支援者の動き","UserLookupID"
 */
export type SupportTemplateCsvRow = {
  タイトル: string;
  UserCode: string;
  RowNo: string;
  時間帯: string;
  活動内容: string;
  本人の動き: string;
  支援者の動き: string;
  UserLookupID?: string;
};

/**
 * CarePoints CSV の1行
 *
 * CSVヘッダー: "Usercode","PointText","IsActive","タイトル","UserLookupID"
 */
export type CarePointCsvRow = {
  Usercode: string;
  PointText: string;
  IsActive: string;
  タイトル: string;
  UserLookupID?: string;
};

/**
 * インポート結果のサマリー
 */
export type ImportResult<T> = {
  /** ユーザーコード別のデータ */
  data: Map<string, T[]>;
  /** パース中にスキップされた行数 */
  skippedRows: number;
  /** 処理された総行数 */
  totalRows: number;
};
