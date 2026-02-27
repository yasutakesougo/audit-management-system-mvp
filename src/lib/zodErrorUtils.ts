import { ZodError, ZodIssue } from 'zod';

export interface ActionableErrorInfo {
  path: string;
  message: string;
  expected?: string;
  received?: string;
  code: string;
}

/**
 * Type guard for ZodError
 */
export const isZodError = (err: unknown): err is ZodError => {
  return err instanceof ZodError || (err != null && typeof err === 'object' && (err as { name?: string }).name === 'ZodError');
};

/**
 * Formats a ZodError into a list of actionable error info.
 * Translates Zod hierarchy into human-readable field names where possible.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const formatZodError = (error: ZodError): ActionableErrorInfo[] => {
  return error.issues.map((issue: ZodIssue) => {
    const path = issue.path.join('.') || '(Root)';
    let message = issue.message;

    // Handle specific Zod issue types for better readability
    if (issue.code === 'invalid_type') {
      const typeIssue = issue as any;
      message = `${path}: Expected ${typeIssue.expected}, received ${typeIssue.received}`;
    } else if (issue.code === 'too_small') {
      const smallIssue = issue as any;
      message = `${path}: Value is too small (Minimum ${smallIssue.minimum})`;
    } else if (issue.code === 'too_big') {
      const bigIssue = issue as any;
      message = `${path}: Value is too big (Maximum ${bigIssue.maximum})`;
    } else if ((issue as any).code === 'invalid_string') {
      const stringIssue = issue as any;
      if (typeof stringIssue.validation === 'string' && stringIssue.validation === 'url') {
        message = `${path}: Invalid URL format`;
      }
    }

    const info: ActionableErrorInfo = {
      path,
      message,
      code: issue.code,
    };

    if ('expected' in issue) {
      info.expected = String((issue as any).expected);
    }
    if ('received' in issue) {
      info.received = String((issue as any).received);
    }

    return info;
  });
};

/**
 * Formats an unknown error into a summary string.
 */
export const getErrorSummary = (err: unknown): string => {
  if (isZodError(err)) {
    const issues = formatZodError(err);
    return `Zod Validation Error: ${issues.length} issues found.\n` +
           issues.map(i => `- ${i.message}`).join('\n');
  }
  if (err instanceof Error) return err.message;
  return String(err);
};

// ---------------------------------------------------------------------------
// Phase 1 Observability: Zod-to-Human 翻訳ユーティリティ
// ---------------------------------------------------------------------------

/**
 * SharePoint フィールド名 → 日本語ラベルの辞書。
 * 登録されていないフィールドは元の名前がそのまま表示される。
 */
export const FIELD_LABEL_MAP: Readonly<Record<string, string>> = {
  // --- Users ---
  Title: '氏名',
  FullName: '氏名（フル）',
  Furigana: 'ふりがな',
  FullNameKana: '氏名カナ',
  UserID: '利用者ID',
  Role: '権限',
  Email: 'メールアドレス',
  OrgCode: '組織コード',
  OrgName: '組織名',
  ContractDate: '契約日',
  ServiceStartDate: 'サービス開始日',
  ServiceEndDate: 'サービス終了日',
  UsageStatus: '利用状況',
  GrantMunicipality: '支給自治体',
  GrantPeriodStart: '支給期間開始',
  GrantPeriodEnd: '支給期間終了',
  DisabilitySupportLevel: '障害支援区分',
  GrantedDaysPerMonth: '月間支給日数',
  UserCopayLimit: '利用者負担上限',
  RecipientCertNumber: '受給者証番号',
  RecipientCertExpiry: '受給者証有効期限',
  IsHighIntensitySupportTarget: '強度行動障害対象',
  IsSupportProcedureTarget: '支援手順書対象',
  severeFlag: '重度フラグ',
  IsActive: '有効',
  IsDisabled: '無効フラグ',
  TransportToDays: '送迎（行き）曜日',
  TransportFromDays: '送迎（帰り）曜日',
  AttendanceDays: '通所曜日',
  TransportAdditionType: '送迎加算種別',
  MealAddition: '食事提供加算',
  CopayPaymentMethod: '負担金支払方法',

  // --- Daily Records ---
  date: '日付',
  userId: '利用者ID',
  userName: '利用者名',
  amActivity: '午前活動',
  pmActivity: '午後活動',
  lunchAmount: '昼食量',
  specialNotes: '特記事項',
  submittedAt: '提出日時',
  userRows: '利用者行データ',
  reporter: '記録者',
  name: '名前',
  role: '役割',
  RecordDate: '記録日',
  ReporterName: '記録者名',
  ReporterRole: '記録者役職',
  UserRowsJSON: '利用者行JSON',
  UserCount: '利用者数',

  // --- Daily: Problem Behavior ---
  problemBehavior: '行動記録',
  selfHarm: '自傷',
  violence: '他害',
  loudVoice: '大声',
  pica: '異食',
  other: 'その他',

  // --- Audit ---
  ts: 'タイムスタンプ',
  actor: '操作者',
  action: '操作',
  entity: '対象エンティティ',
  entity_id: '対象ID',
  channel: 'チャネル',
  after_json: '変更後データ',
  entry_hash: 'エントリハッシュ',

  // --- Metadata ---
  Id: 'ID',
  Created: '作成日時',
  Modified: '更新日時',

  // --- Env ---
  VITE_SP_RESOURCE: 'SharePointリソースURL',
  VITE_SP_SITE_RELATIVE: 'サイト相対パス',
  VITE_MSAL_CLIENT_ID: 'MSALクライアントID',
  VITE_MSAL_TENANT_ID: 'MSALテナントID',
};

/**
 * Zod パスセグメント配列を日本語ラベルに変換する。
 * 例: `['problemBehavior', 'selfHarm']` → `「行動記録 > 自傷」`
 */
export const translatePath = (segments: (string | number)[]): string => {
  if (segments.length === 0) return '(ルート)';
  const translated = segments.map(seg =>
    typeof seg === 'number' ? `[${seg}]` : (FIELD_LABEL_MAP[seg] ?? seg)
  );
  return `「${translated.join(' > ')}」`;
};

/**
 * 1 件の ZodIssue を職員向け日本語メッセージに変換する。
 *
 * @example
 * translateZodIssue(issue)
 * // → '「氏名」に想定外の値が入っています（期待: string, 実際: undefined）'
 */
export const translateZodIssue = (issue: ZodIssue): string => {
  const path = translatePath(issue.path as (string | number)[]);
  const iss = issue as any;
  const code = String(issue.code);

  switch (code) {
    case 'invalid_type':
      return `${path} に想定外の値が入っています（期待: ${iss.expected}, 実際: ${iss.received}）`;

    case 'too_small': {
      // Zod v3: iss.type, Zod v4: iss.origin
      const origin = iss.type ?? iss.origin;
      if (origin === 'string') {
        return iss.minimum === 1
          ? `${path} は必須項目です`
          : `${path} の入力が短すぎます（最低${iss.minimum}文字）`;
      }
      if (origin === 'array') {
        return `${path} には最低${iss.minimum}件のデータが必要です`;
      }
      return `${path} の値が小さすぎます（最小: ${iss.minimum}）`;
    }

    case 'too_big': {
      const origin = iss.type ?? iss.origin;
      if (origin === 'string') {
        return `${path} の入力が長すぎます（最大${iss.maximum}文字）`;
      }
      if (origin === 'array') {
        return `${path} のデータが多すぎます（最大${iss.maximum}件）`;
      }
      return `${path} の値が大きすぎます（最大: ${iss.maximum}）`;
    }

    case 'invalid_string':
    case 'invalid_format':
      if (iss.validation === 'datetime' || iss.format === 'datetime') {
        return `${path} の日付形式が正しくありません（例: 2026-02-27T10:00:00）`;
      }
      if (iss.validation === 'url' || iss.format === 'url') {
        return `${path} のURL形式が正しくありません（例: https://...）`;
      }
      if (iss.validation === 'email' || iss.format === 'email') {
        return `${path} のメールアドレス形式が正しくありません`;
      }
      if (typeof iss.validation === 'object' && iss.validation?.includes === 'regex') {
        return `${path} の形式が正しくありません`;
      }
      return `${path} の入力形式が正しくありません`;

    // Zod v3: invalid_enum_value, Zod v4: invalid_value
    case 'invalid_enum_value':
    case 'invalid_value': {
      const options = (iss.options as string[])?.join(', ') ?? '';
      const received = iss.received ?? '';
      return options
        ? `${path} に許可されていない値「${received}」が入っています。選択肢: ${options}`
        : `${path} に許可されていない値が入っています`;
    }

    case 'invalid_union':
      return `${path} の値がどの許可パターンにも一致しません`;

    case 'custom':
      return `${path}: ${issue.message}`;

    default:
      return `${path} の入力に問題があります（${issue.message}）`;
  }
};

/**
 * `getErrorSummary` の日本語版。
 * ConfigErrorBoundary 等から呼ばれてユーザー向けサマリーを返す。
 */
export const getHumanErrorSummary = (err: unknown): string => {
  if (isZodError(err)) {
    const lines = err.issues.map(translateZodIssue);
    return `データ検証エラー（${lines.length}件）:\n` + lines.map(l => `・${l}`).join('\n');
  }
  if (err instanceof Error) return err.message;
  return String(err);
};
