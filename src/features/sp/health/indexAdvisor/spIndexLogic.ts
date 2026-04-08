import { type IndexFieldSpec } from './spIndexKnownConfig';

export interface SpIndexedField {
  internalName: string;
  displayName: string;
  typeAsString: string;
  /** なぜ削除候補なのか（型 + 名前ヒューリスティックで計算） */
  deletionReason: string;
}

export interface IndexDiffResult {
  /** SP にインデックスがあるが必須セットにない → 削除候補 */
  deletionCandidates: SpIndexedField[];
  /** 必須セットにあるが SP にインデックスがない → 追加候補 */
  additionCandidates: IndexFieldSpec[];
  /** SP に存在する全インデックス済みフィールド（システムフィールド除外後） */
  currentIndexed: SpIndexedField[];
}

// ── System field filter ────────────────────────────────────────────────────────

const SYSTEM_FIELDS = new Set([
  'ID', 'Id', 'Title', 'Author', 'Editor', 'Created', 'Modified',
  'ContentType', 'ContentTypeId', 'FileLeafRef', 'FileDirRef',
  'FileRef', 'FSObjType', 'UniqueId', 'owshiddenversion',
  '_ModerationStatus', '_ModerationComments', 'ProgId',
  'ScopeId', 'CheckedOutUserId', 'IsCheckedoutToLocal',
  'CheckoutUser', 'LinkCheckedOutTitle', 'LinkFilenameNoMenu',
  'LinkFilename', 'DocIcon', 'ServerUrl', 'EncodedAbsUrl',
  'BaseName', 'MetaInfo', 'Last_x0020_Modified', 'Created_x0020_Date',
  'InstanceID', 'Order', 'GUID', 'WorkflowVersion', 'WorkflowInstanceID',
  'ParentVersionString', 'ParentLeafName', 'SyncClientId',
  '_EditMenuTableStart', '_EditMenuTableEnd', 'ServerRedirected',
  'Attachments', 'Edit', 'SelectTitle', 'SelectFilename',
  'ItemChildCount', 'FolderChildCount', 'AppAuthor', 'AppEditor',
]);

/**
 * システム管理フィールドかどうかを判定する
 */
export function isSystemField(internalName: string): boolean {
  return SYSTEM_FIELDS.has(internalName) || internalName.startsWith('_');
}

// ── Deletion reason heuristics ────────────────────────────────────────────────

/**
 * フィールドの型・名前からなぜ削除候補なのかを説明する文字列を生成する。
 * 必須セット外であることを前提として、より具体的な理由を付与する。
 */
export function computeDeletionReason(internalName: string, typeAsString: string): string {
  const n = internalName.toLowerCase();

  // 型ベース
  if (typeAsString === 'Note') {
    return 'Note型はインデックス不可（SP制約） — 設定が残っているだけの可能性があります';
  }
  if (typeAsString === 'Computed') {
    return 'Computed型はインデックス非推奨 — パフォーマンス劣化の原因になり得ます';
  }
  if (typeAsString === 'Integer' || typeAsString === 'Counter') {
    return 'SP内部カウンター型 — 通常インデックス不要です';
  }

  // 名前ベース
  if (n.includes('json') || n.includes('payload') || n.includes('rows') || n.includes('blob')) {
    return '大容量フィールド（JSON/Blob系） — $filter での直接利用は想定外のケースが多いです';
  }
  if (n.includes('note') || n.includes('memo') || n.includes('comment') || n.includes('remark')) {
    return 'メモ/備考系フィールド — $filter に使っていなければ削除でスロット節約できます';
  }
  if (n.includes('temp') || n.includes('old') || n.includes('legacy') || n.includes('archive') || n.includes('backup')) {
    return '一時/旧フィールドの可能性 — 現在も利用中か確認してから削除してください';
  }
  if (n.endsWith('id') && !n.includes('parent') && !n.includes('user') && !n.includes('staff')) {
    return 'ID系フィールド（必須セット外） — $filter で参照されているか確認してください';
  }

  // デフォルト
  return '必須セット外 — $filter/$orderby での利用を確認してから削除を判断してください';
}

// ── Pure Logic Engine ───────────────────────────────────────────────────────

/**
 * 現在の状態 (Raw) と必須セットから、差分（削除/追加候補）を計算する純粋関数
 */
export function calculateIndexDiff(
  rawIndexedFields: { InternalName: string; Title: string; TypeAsString: string }[],
  requiredSet: IndexFieldSpec[] | undefined
): IndexDiffResult {
  const hasKnownConfig = Boolean(requiredSet);

  // 1. システムフィールドを除外し、ドメイン型に変換
  const allIndexed: SpIndexedField[] = rawIndexedFields
    .filter((f) => !isSystemField(f.InternalName))
    .map((f) => ({
      internalName: f.InternalName,
      displayName: f.Title,
      typeAsString: f.TypeAsString,
      deletionReason: computeDeletionReason(f.InternalName, f.TypeAsString),
    }));

  const requiredNames = new Set(requiredSet?.map((f) => f.internalName) ?? []);
  const currentNames = new Set(allIndexed.map((f) => f.internalName));

  // 2. 削除候補の計算 (SPにあるが、必須セットにない)
  const deletionCandidates = hasKnownConfig
    ? allIndexed.filter((f) => !requiredNames.has(f.internalName))
    : [];

  // 3. 追加候補の計算 (必須セットにあるが、SPにない)
  const additionCandidates = hasKnownConfig
    ? (requiredSet ?? []).filter((f) => !currentNames.has(f.internalName))
    : [];

  return {
    currentIndexed: allIndexed,
    deletionCandidates,
    additionCandidates,
  };
}
