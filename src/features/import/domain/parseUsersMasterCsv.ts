// ---------------------------------------------------------------------------
// parseUsersMasterCsv — Users_Master CSV → IUserMasterCreateDto[] 変換
//
// SharePoint Users_Master リストからエクスポートされた CSV を
// IUserMasterCreateDto（利用者マスタ作成DTO）に変換する純粋関数。
// ---------------------------------------------------------------------------
import Papa from 'papaparse';

import type { ImportResult } from './csvImportTypes';

// ---------------------------------------------------------------------------
// CSVカラム定義（SharePoint エクスポート形式 + 日本語ヘッダー対応）
// ---------------------------------------------------------------------------

/**
 * Users_Master CSV の1行（日本語 or 英語ヘッダー両対応）
 */
export type UserMasterCsvRow = Record<string, string | undefined>;

/**
 * パース後の正規化済みユーザーデータ
 */
export type ParsedUserRecord = {
  UserID: string;
  FullName: string;
  Furigana: string | null;
  FullNameKana: string | null;
  ContractDate: string | null;
  ServiceStartDate: string | null;
  ServiceEndDate: string | null;
  IsHighIntensitySupportTarget: boolean;
  IsSupportProcedureTarget: boolean;
  severeFlag: boolean;
  IsActive: boolean;
  AttendanceDays: string[];
  TransportToDays: string[];
  TransportFromDays: string[];
  RecipientCertNumber: string | null;
  RecipientCertExpiry: string | null;
  UsageStatus: string | null;
  GrantMunicipality: string | null;
  GrantPeriodStart: string | null;
  GrantPeriodEnd: string | null;
  DisabilitySupportLevel: string | null;
  GrantedDaysPerMonth: string | null;
  UserCopayLimit: string | null;
  TransportAdditionType: string | null;
  MealAddition: string | null;
  CopayPaymentMethod: string | null;
};

// ---------------------------------------------------------------------------
// ヘッダーマッピング（日本語ヘッダー → 内部フィールド名）
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<string, string> = {
  // 日本語ヘッダー
  '利用者ID': 'UserID',
  '利用者コード': 'UserID',
  'ユーザーID': 'UserID',
  '氏名': 'FullName',
  '利用者名': 'FullName',
  'ふりがな': 'Furigana',
  'フリガナ': 'FullNameKana',
  '契約日': 'ContractDate',
  'サービス開始日': 'ServiceStartDate',
  'サービス終了日': 'ServiceEndDate',
  '強度行動障害対象': 'IsHighIntensitySupportTarget',
  '支援手順記録対象': 'IsSupportProcedureTarget',
  '重度フラグ': 'severeFlag',
  '有効': 'IsActive',
  '利用曜日': 'AttendanceDays',
  '通所送り曜日': 'TransportToDays',
  '通所迎え曜日': 'TransportFromDays',
  '受給者証番号': 'RecipientCertNumber',
  '受給者証有効期限': 'RecipientCertExpiry',
  '利用状況': 'UsageStatus',
  '支給決定市区町村': 'GrantMunicipality',
  '支給開始日': 'GrantPeriodStart',
  '支給終了日': 'GrantPeriodEnd',
  '障害支援区分': 'DisabilitySupportLevel',
  '支給日数': 'GrantedDaysPerMonth',
  '利用者負担上限': 'UserCopayLimit',
  '送迎加算種別': 'TransportAdditionType',
  '食事加算': 'MealAddition',
  '自己負担支払方法': 'CopayPaymentMethod',
  // 英語ヘッダーはそのまま（パススルー）
};

function resolveHeader(raw: string): string {
  const trimmed = raw.trim();
  return HEADER_ALIASES[trimmed] ?? trimmed;
}

// ---------------------------------------------------------------------------
// 値パーサー
// ---------------------------------------------------------------------------

function parseBool(value?: string): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'はい' || v === '○' || v === 'yes';
}

function parseDayArray(value?: string): string[] {
  if (!value) return [];
  // カンマ区切り or スラッシュ区切り or スペース区切り
  return value
    .split(/[,/、\s]+/)
    .map((d) => d.trim())
    .filter(Boolean);
}

function nullIfEmpty(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

// ---------------------------------------------------------------------------
// メインパーサー
// ---------------------------------------------------------------------------

/**
 * Users_Master CSV 文字列をパースし、ユーザーID別の ParsedUserRecord 配列を返す。
 *
 * @param csvString - UTF-8 の CSV テキスト
 * @returns ユーザーID → ParsedUserRecord[] の Map（通常は各IDに1レコード）
 *
 * @example
 * ```ts
 * const result = parseUsersMasterCsv(csvText);
 * // result.data → Map(30) { 'U-001' => [{...}], 'U-002' => [{...}], ... }
 * ```
 */
export function parseUsersMasterCsv(csvString: string): ImportResult<ParsedUserRecord> {
  const parsed = Papa.parse<UserMasterCsvRow>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => resolveHeader(header),
  });

  const data = new Map<string, ParsedUserRecord[]>();
  let skippedRows = 0;

  for (const row of parsed.data) {
    const userId = (row.UserID ?? row.Title)?.trim();
    const fullName = row.FullName?.trim();

    // 必須: UserID と FullName
    if (!userId || !fullName) {
      skippedRows++;
      continue;
    }

    const record: ParsedUserRecord = {
      UserID: userId,
      FullName: fullName,
      Furigana: nullIfEmpty(row.Furigana),
      FullNameKana: nullIfEmpty(row.FullNameKana),
      ContractDate: nullIfEmpty(row.ContractDate),
      ServiceStartDate: nullIfEmpty(row.ServiceStartDate),
      ServiceEndDate: nullIfEmpty(row.ServiceEndDate),
      IsHighIntensitySupportTarget: parseBool(row.IsHighIntensitySupportTarget),
      IsSupportProcedureTarget: parseBool(row.IsSupportProcedureTarget),
      severeFlag: parseBool(row.severeFlag),
      IsActive: row.IsActive ? parseBool(row.IsActive) : true, // デフォルト有効
      AttendanceDays: parseDayArray(row.AttendanceDays),
      TransportToDays: parseDayArray(row.TransportToDays),
      TransportFromDays: parseDayArray(row.TransportFromDays),
      RecipientCertNumber: nullIfEmpty(row.RecipientCertNumber),
      RecipientCertExpiry: nullIfEmpty(row.RecipientCertExpiry),
      UsageStatus: nullIfEmpty(row.UsageStatus),
      GrantMunicipality: nullIfEmpty(row.GrantMunicipality),
      GrantPeriodStart: nullIfEmpty(row.GrantPeriodStart),
      GrantPeriodEnd: nullIfEmpty(row.GrantPeriodEnd),
      DisabilitySupportLevel: nullIfEmpty(row.DisabilitySupportLevel),
      GrantedDaysPerMonth: nullIfEmpty(row.GrantedDaysPerMonth),
      UserCopayLimit: nullIfEmpty(row.UserCopayLimit),
      TransportAdditionType: nullIfEmpty(row.TransportAdditionType),
      MealAddition: nullIfEmpty(row.MealAddition),
      CopayPaymentMethod: nullIfEmpty(row.CopayPaymentMethod),
    };

    if (!data.has(userId)) {
      data.set(userId, []);
    }
    data.get(userId)!.push(record);
  }

  return {
    data,
    skippedRows,
    totalRows: parsed.data.length,
  };
}

// ---------------------------------------------------------------------------
// バリデーション
// ---------------------------------------------------------------------------

export type ValidationIssue = {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
};

/**
 * パース済みデータの検証を行い、問題のリストを返す。
 */
export function validateUserRecords(
  records: Map<string, ParsedUserRecord[]>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let rowIndex = 1;

  for (const [userId, items] of records) {
    for (const record of items) {
      // 重複チェック
      if (items.length > 1) {
        issues.push({
          row: rowIndex,
          field: 'UserID',
          message: `利用者ID "${userId}" が複数行に存在します`,
          severity: 'warning',
        });
      }

      // 日付フォーマットチェック
      const dateFields = [
        'ContractDate', 'ServiceStartDate', 'ServiceEndDate',
        'GrantPeriodStart', 'GrantPeriodEnd', 'RecipientCertExpiry',
      ] as const;

      for (const field of dateFields) {
        const value = record[field];
        if (value && !/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value)) {
          issues.push({
            row: rowIndex,
            field,
            message: `日付形式が不正です: "${value}"（YYYY-MM-DD 推奨）`,
            severity: 'warning',
          });
        }
      }

      // FullName が空でないことは既にチェック済み
      rowIndex++;
    }
  }

  return issues;
}
