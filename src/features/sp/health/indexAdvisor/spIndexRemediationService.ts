import { useSP } from '@/lib/spClient';
import { emitIndexRemediationRecord } from '@/features/diagnostics/drift/domain/driftLogic';
import { findListEntry } from '@/sharepoint/spListRegistry';

export type IndexRemediationAction = 'create' | 'delete';

export interface IndexRemediationInput {
  listTitle: string;
  internalName: string;
  action: IndexRemediationAction;
}

export interface IndexRemediationResult {
  success: boolean;
  message: string;
  action: IndexRemediationAction;
  listTitle: string;
  internalName: string;
  timestamp: string;
}

/**
 * SharePoint インデックスの自動修復（作成・削除）を実行するサービス層
 * 
 * 責務:
 * 1. 入力値（リスト・フィールド）の妥当性検証
 * 2. 破壊的アクション（削除）のガードレール
 * 3. 実行および監査ログ（DriftEventsLog）への記録
 */
export async function executeIndexRemediation(
  sp: ReturnType<typeof useSP>,
  input: IndexRemediationInput
): Promise<IndexRemediationResult> {
  const { listTitle, internalName, action } = input;
  const timestamp = new Date().toISOString();

  // 1. 基本検証
  if (!listTitle || !internalName) {
    return {
      success: false,
      message: 'リストタイトルまたは内部名が指定されていません。',
      action,
      listTitle,
      internalName,
      timestamp,
    };
  }

  // 2. SSOT (Registry) による存在確認
  const entry = findListEntry(listTitle);
  if (!entry) {
    const errorMsg = `リスト "${listTitle}" はレジストリで見つかりません。`;
    emitIndexRemediationRecord(listTitle, internalName, action, 'error', errorMsg);
    return {
      success: false,
      message: errorMsg,
      action,
      listTitle,
      internalName,
      timestamp,
    };
  }

  // 3. 破壊的アクション（削除）のガード
  // 現在のフェーズでは追加 (create) のみを優先的にサポートする
  if (action === 'delete') {
    // 削除は将来的な実装とするか、より慎重な警告が必要
    // 本サービスでは受け付けるが、UI側で十分な警告を出すことを想定
    // eslint-disable-next-line no-console
    console.warn(`[IndexRemediation] Destructive action "${action}" requested for ${listTitle}.${internalName}`);
  }

  try {
    // 4. 実行
    const indexed = action === 'create';
    
    // spClient の updateField を使用
    // 注意: Indexed プロパティは Boolean
    const status = await sp.updateField(listTitle, internalName, { Indexed: indexed });

    if (status === 'error') {
      throw new Error('SharePoint 内部エラーによりフィールドの更新に失敗しました。');
    }

    // 5. 成功ログ（監査ログへの記録）
    emitIndexRemediationRecord(listTitle, internalName, action, 'success');

    return {
      success: true,
      message: `${internalName} のインデックスを${action === 'create' ? '作成' : '削除'}しました。`,
      action,
      listTitle,
      internalName,
      timestamp,
    };
  } catch (err) {
    // 6. 失敗ログ
    const errorMsg = err instanceof Error ? err.message : String(err);
    emitIndexRemediationRecord(listTitle, internalName, action, 'error', errorMsg);

    return {
      success: false,
      message: `インデックス${action === 'create' ? '作成' : '削除'}に失敗しました: ${errorMsg}`,
      action,
      listTitle,
      internalName,
      timestamp,
    };
  }
}
