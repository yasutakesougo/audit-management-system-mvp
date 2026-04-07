import { type SpListOperations } from '@/lib/sp/spLists';
import { emitIndexRemediationRecord } from '@/features/diagnostics/drift/domain/driftLogic';
import { auditLog } from '@/lib/debugLogger';
import { type SpIndexRepairAction } from './spIndexRepairPlanner';

/**
 * 修復アクションの実行結果
 */
export interface SpIndexRepairResult {
  action: SpIndexRepairAction;
  status: 'success' | 'error';
  errorDetail?: string;
  timestamp: string;
}

/**
 * 修復アクションのリスク/副作用判定
 */
export interface SpIndexRepairSummary {
  results: SpIndexRepairResult[];
  successCount: number;
  errorCount: number;
  totalCount: number;
}

/**
 * 個修復アクションの実行
 */
export async function executeRepairAction(
  spClient: Pick<SpListOperations, 'updateField'>,
  action: SpIndexRepairAction
): Promise<SpIndexRepairResult> {
  const { listName, internalName, type } = action;
  const isIndexed = type === 'create';

  try {
    const result = await spClient.updateField(listName, internalName, {
      Indexed: isIndexed
    });

    if (result === 'error') {
      throw new Error(`SharePoint API returned "error" for ${internalName}`);
    }

    // テレメトリ送信（Nightly Patrol 連携用）
    emitIndexRemediationRecord(listName, internalName, type, 'success');

    auditLog.info('sp:remediation', `Successfully ${type}d index for ${listName}.${internalName}`);

    return {
      action,
      status: 'success',
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    
    // エラーテレメトリ
    emitIndexRemediationRecord(listName, internalName, type, 'error', detail);

    auditLog.error('sp:remediation', `Failed to ${type} index for ${listName}.${internalName}`, { detail });

    return {
      action,
      status: 'error',
      errorDetail: detail,
      timestamp: new Date().toISOString()
    };
  }
}
