/**
 * useSpIndexCandidates — SP リストの現在のインデックス状態を取得し、
 * 削除候補・追加候補を計算する Hook
 *
 * - SP REST: lists/getbytitle('X')/fields?$filter=Indexed eq true
 * - 既知必須フィールドとのデルタで候補を算出
 * - Fail-open: エラー時は error を返すだけでクラッシュしない
 */

import React from 'react';
import { useSP } from '@/lib/spClient';
import { KNOWN_REQUIRED_INDEXED_FIELDS, type IndexFieldSpec } from './spIndexKnownConfig';

export interface SpIndexedField {
  internalName: string;
  displayName: string;
  typeAsString: string;
  /** なぜ削除候補なのか（型 + 名前ヒューリスティックで計算） */
  deletionReason: string;
}

export interface SpIndexCandidates {
  /** SP に存在する全インデックス済みフィールド */
  currentIndexed: SpIndexedField[];
  /** SP にインデックスがあるが必須セットにない → 削除候補 */
  deletionCandidates: SpIndexedField[];
  /** 必須セットにあるが SP にインデックスがない → 追加候補 */
  additionCandidates: IndexFieldSpec[];
  /** このリストの既知必須セットが定義されているか */
  hasKnownConfig: boolean;
  loading: boolean;
  error: string | null;
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

function isSystemField(internalName: string): boolean {
  return SYSTEM_FIELDS.has(internalName) || internalName.startsWith('_');
}

// ── Deletion reason heuristics ────────────────────────────────────────────────

/**
 * フィールドの型・名前からなぜ削除候補なのかを説明する文字列を生成する。
 * 必須セット外であることを前提として、より具体的な理由を付与する。
 */
function computeDeletionReason(internalName: string, typeAsString: string): string {
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
  if (n.includes('note') || n.includes('memo') || n.includes('comment') || n.includes('remark') || n.includes('remark')) {
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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSpIndexCandidates(
  listName: string | undefined,
  reloadKey = 0,
): SpIndexCandidates {
  const sp = useSP();
  const [state, setState] = React.useState<SpIndexCandidates>({
    currentIndexed: [],
    deletionCandidates: [],
    additionCandidates: [],
    hasKnownConfig: false,
    loading: false,
    error: null,
  });

  React.useEffect(() => {
    if (!sp || !listName) return;

    setState((p) => ({ ...p, loading: true, error: null }));

    const doFetch = async () => {
      try {
        const path = `lists/getbytitle('${encodeURIComponent(listName)}')/fields?$filter=Indexed eq true&$select=InternalName,Title,TypeAsString`;
        const res = await sp.spFetch(path);
        const json = await res.json().catch(() => ({ value: [] })) as {
          value?: { InternalName: string; Title: string; TypeAsString: string }[];
        };

        const allIndexed: SpIndexedField[] = (json.value ?? [])
          .filter((f) => !isSystemField(f.InternalName))
          .map((f) => ({
            internalName: f.InternalName,
            displayName: f.Title,
            typeAsString: f.TypeAsString,
            deletionReason: computeDeletionReason(f.InternalName, f.TypeAsString),
          }));

        const requiredSet = KNOWN_REQUIRED_INDEXED_FIELDS[listName];
        const hasKnownConfig = Boolean(requiredSet);

        const requiredNames = new Set(requiredSet?.map((f) => f.internalName) ?? []);
        const currentNames = new Set(allIndexed.map((f) => f.internalName));

        const deletionCandidates = hasKnownConfig
          ? allIndexed.filter((f) => !requiredNames.has(f.internalName))
          : [];

        const additionCandidates = hasKnownConfig
          ? (requiredSet ?? []).filter((f) => !currentNames.has(f.internalName))
          : [];

        setState({
          currentIndexed: allIndexed,
          deletionCandidates,
          additionCandidates,
          hasKnownConfig,
          loading: false,
          error: null,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState((p) => ({ ...p, loading: false, error: msg }));
      }
    };

    doFetch();
  // eslint-disable-line
  }, [listName, reloadKey]);

  return state;
}
