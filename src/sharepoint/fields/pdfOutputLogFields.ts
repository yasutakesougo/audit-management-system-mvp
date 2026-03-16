/**
 * SharePoint フィールド定義 — PdfOutput_Log
 *
 * 帳票出力（PDF/Excel）の監査証跡を記録するリスト。
 * Power Automate から自動記録、または手動出力時にアプリから記録。
 *
 * Title (複合キー): {OutputType}_{UserCode}_{TargetPeriod}
 *   例: monthly-report_U001_2026-03
 *
 * 監査 P1-2 追加
 */

export const PDF_OUTPUT_LOG_LIST_TITLE = 'PdfOutput_Log' as const;

export const PDF_OUTPUT_LOG_FIELDS = {
  id: 'Id',
  title: 'Title',              // composite key: {OutputType}_{UserCode}_{TargetPeriod}
  outputType: 'OutputType',     // Choice: monthly-report | service-provision | isp | billing | attendance
  userCode: 'UserCode',         // 対象利用者コード (Users_Master.UserID)
  outputDate: 'OutputDate',     // 出力日 (ISO date)
  targetPeriod: 'TargetPeriod', // 対象期間 (e.g. '2026-03')
  fileName: 'FileName',         // 出力ファイル名
  fileUrl: 'FileUrl',           // SharePoint ファイル URL
  outputBy: 'OutputBy',         // 出力実行者 (UPN or StaffId)
  status: 'Status',             // Choice: success | failed | pending
  errorMessage: 'ErrorMessage', // エラー時のメッセージ
  source: 'Source',             // Choice: power-automate | manual | scheduled
  created: 'Created',
  modified: 'Modified',
} as const;

export const PDF_OUTPUT_LOG_SELECT_FIELDS = [
  PDF_OUTPUT_LOG_FIELDS.id,
  PDF_OUTPUT_LOG_FIELDS.title,
  PDF_OUTPUT_LOG_FIELDS.outputType,
  PDF_OUTPUT_LOG_FIELDS.userCode,
  PDF_OUTPUT_LOG_FIELDS.outputDate,
  PDF_OUTPUT_LOG_FIELDS.targetPeriod,
  PDF_OUTPUT_LOG_FIELDS.fileName,
  PDF_OUTPUT_LOG_FIELDS.fileUrl,
  PDF_OUTPUT_LOG_FIELDS.outputBy,
  PDF_OUTPUT_LOG_FIELDS.status,
  PDF_OUTPUT_LOG_FIELDS.source,
  PDF_OUTPUT_LOG_FIELDS.created,
  PDF_OUTPUT_LOG_FIELDS.modified,
] as const;

/**
 * PdfOutput_Log の Title キーを生成する
 */
export function buildPdfOutputLogTitle(
  outputType: string,
  userCode: string,
  targetPeriod: string,
): string {
  return `${outputType}_${userCode}_${targetPeriod}`;
}
