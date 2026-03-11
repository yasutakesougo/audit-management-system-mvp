import { ZodError, ZodIssue } from 'zod';

// ===========================================================================
// 設計方針 (Design Decisions)
// ===========================================================================
// 1. `as any` を全廃し、Zod v4 の ZodIssue discriminated union を
//    `switch (issue.code)` で直接ナローイングする。
//    → Extract<> 型エイリアスも不要。issue 種別の増減に自動追従。
//
// 2. Zod v3 にしか存在しないコード (invalid_string, invalid_enum_value) は
//    v4 の union リテラル型に含まれないため switch の case に書けない。
//    → string 変数への代入 + if 文字列比較で switch **前** に処理する。
//
// 3. ライブラリ境界で完全な型が取れない箇所 (v3 の options / received 等) は
//    `as unknown as Record<string, unknown>` で **境界だけを丁寧に緩める**。
//    `as any` のように型情報を全て捨てるのではなく、Record に限定することで
//    アクセス先で Array.isArray 等のランタイムガードが効く。
// ===========================================================================

// ---------------------------------------------------------------------------
// Zod v3 互換: ZodIssue に `expected` / `received` / `validation` 等が
// 存在するかどうかを in ガードで安全に判定するための型
// ---------------------------------------------------------------------------
interface ZodV3InvalidTypeShape {
  expected: string;
  received: string;
}
interface ZodV3TooSmallShape {
  type: string;
  minimum: number | bigint;
}
interface ZodV3TooBigShape {
  type: string;
  maximum: number | bigint;
}
interface ZodV3InvalidStringShape {
  validation: string | { includes?: string };
}
// Type-safe in-guard helpers
const hasExpectedReceived = (issue: ZodIssue): issue is ZodIssue & ZodV3InvalidTypeShape =>
  'expected' in issue && 'received' in issue;

const hasValidation = (issue: ZodIssue): issue is ZodIssue & ZodV3InvalidStringShape =>
  'validation' in issue;

/**
 * Derive the "received" type string for invalid_type issues.
 * - Zod v3: `received` field exists directly
 * - Zod v4: no `received`, but `input` may be available; derive via typeof
 * - Fallback: extract from Zod's message string ("received TYPE")
 */
const getReceivedType = (issue: ZodIssue): string => {
  // v3 path: received is a direct field
  if (hasExpectedReceived(issue)) return issue.received;
  // v4 path: derive from input (when present)
  if ('input' in issue) {
    const input = (issue as ZodIssue & { input: unknown }).input;
    if (input === null) return 'null';
    if (input === undefined) return 'undefined';
    if (Array.isArray(input)) return 'array';
    return typeof input;
  }
  // v4 fallback: extract from message ("Invalid input: expected X, received Y")
  const match = issue.message.match(/received\s+(\w+)/);
  if (match) return match[1];
  return 'unknown';
};


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
export const formatZodError = (error: ZodError): ActionableErrorInfo[] => {
  return error.issues.map((issue: ZodIssue) => {
    const path = issue.path.join('.') || '(Root)';
    let message = issue.message;

    // Handle specific Zod issue types for better readability
    if (issue.code === 'invalid_type') {
      // Zod v4: only `expected` exists. Zod v3: both `expected` and `received`.
      const received = getReceivedType(issue);
      message = `${path}: Expected ${issue.expected}, received ${received}`;
    } else if (issue.code === 'too_small') {
      message = `${path}: Value is too small (Minimum ${issue.minimum})`;
    } else if (issue.code === 'too_big') {
      message = `${path}: Value is too big (Maximum ${issue.maximum})`;
    } else if (issue.code === 'invalid_format') {
      if (issue.format === 'url') {
        message = `${path}: Invalid URL format`;
      }
    } else if (hasValidation(issue)) {
      // Zod v3 `invalid_string` compat
      if (issue.validation === 'url') {
        message = `${path}: Invalid URL format`;
      }
    }

    const info: ActionableErrorInfo = {
      path,
      message,
      code: issue.code ?? 'unknown',
    };

    if (hasExpectedReceived(issue)) {
      info.expected = String(issue.expected);
      info.received = String(issue.received);
    } else if (issue.code === 'invalid_type') {
      info.expected = String(issue.expected);
      info.received = getReceivedType(issue);
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
  otherInjury: '他傷',
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
 * Zod v3 / v4 両方のフィールド名に対応:
 * - v3: `type` / `validation` / `options` / `received`
 * - v4: `origin` / `format` / `values`
 *
 * @example
 * translateZodIssue(issue)
 * // → '「氏名」に想定外の値が入っています（期待: string, 実際: undefined）'
 */
export const translateZodIssue = (issue: ZodIssue): string => {
  const path = translatePath(issue.path as (string | number)[]);
  // Store code as string to avoid discriminated union narrowing issues
  // when checking Zod v3-only codes that don't exist in v4's union
  const code: string = issue.code ?? '';

  // -----------------------------------------------------------------------
  // Zod v3 compat: codes that don't exist in v4's discriminated union.
  // TypeScript の switch case は union リテラル型を厳密に検査するため、
  // v4 に存在しない 'invalid_string' / 'invalid_enum_value' は case に
  // 書くと TS2678 になる。string 型の code 変数と if で先処理する。
  // -----------------------------------------------------------------------
  if (code === 'invalid_string') {
    if (hasValidation(issue)) {
      const validation = issue.validation;
      if (validation === 'datetime') {
        return `${path} の日付形式が正しくありません（例: 2026-02-27T10:00:00）`;
      }
      if (validation === 'url') {
        return `${path} のURL形式が正しくありません（例: https://...）`;
      }
      if (validation === 'email') {
        return `${path} のメールアドレス形式が正しくありません`;
      }
      if (typeof validation === 'object' && validation?.includes === 'regex') {
        return `${path} の形式が正しくありません`;
      }
    }
    return `${path} の入力形式が正しくありません`;
  }

  if (code === 'invalid_enum_value') {
    // v3 の invalid_enum_value は options/received を持つが v4 の型定義には
    // ないため、unknown → Record<string, unknown> で境界を緩めてから
    // Array.isArray で安全に検査する。
    const raw = issue as unknown as Record<string, unknown>;
    const options = Array.isArray(raw.options) ? (raw.options as string[]) : [];
    const received = hasExpectedReceived(issue) ? issue.received : '';
    return options.length > 0
      ? `${path} に許可されていない値「${received}」が入っています。選択肢: ${options.join(', ')}`
      : `${path} に許可されていない値が入っています`;
  }

  // -----------------------------------------------------------------------
  // Zod v4 codes: proper discriminated union narrowing via switch
  // -----------------------------------------------------------------------
  switch (issue.code) {
    case 'invalid_type': {
      const received = getReceivedType(issue);
      return `${path} に想定外の値が入っています（期待: ${issue.expected}, 実際: ${received}）`;
    }

    case 'too_small': {
      // Zod v3: issue.type, Zod v4: issue.origin
      const origin: string =
        issue.origin ?? ('type' in issue ? String((issue as ZodIssue & ZodV3TooSmallShape).type) : '');
      if (origin === 'string') {
        return issue.minimum === 1
          ? `${path} は必須項目です`
          : `${path} の入力が短すぎます（最低${issue.minimum}文字）`;
      }
      if (origin === 'array') {
        return `${path} には最低${issue.minimum}件のデータが必要です`;
      }
      return `${path} の値が小さすぎます（最小: ${issue.minimum}）`;
    }

    case 'too_big': {
      const origin: string =
        issue.origin ?? ('type' in issue ? String((issue as ZodIssue & ZodV3TooBigShape).type) : '');
      if (origin === 'string') {
        return `${path} の入力が長すぎます（最大${issue.maximum}文字）`;
      }
      if (origin === 'array') {
        return `${path} のデータが多すぎます（最大${issue.maximum}件）`;
      }
      return `${path} の値が大きすぎます（最大: ${issue.maximum}）`;
    }

    case 'invalid_format': {
      if (issue.format === 'datetime') {
        return `${path} の日付形式が正しくありません（例: 2026-02-27T10:00:00）`;
      }
      if (issue.format === 'url') {
        return `${path} のURL形式が正しくありません（例: https://...）`;
      }
      if (issue.format === 'email') {
        return `${path} のメールアドレス形式が正しくありません`;
      }
      if (issue.format === 'regex') {
        return `${path} の形式が正しくありません`;
      }
      return `${path} の入力形式が正しくありません`;
    }

    case 'invalid_value': {
      const values = issue.values?.map(String).join(', ') ?? '';
      return values
        ? `${path} に許可されていない値が入っています。選択肢: ${values}`
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
