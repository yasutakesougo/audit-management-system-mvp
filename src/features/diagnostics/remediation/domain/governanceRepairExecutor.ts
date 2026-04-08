import { type SpListOperations } from '@/lib/sp/spLists';
import { auditLog } from '@/lib/debugLogger';
import { type GovernanceRecommendation, type GovernanceActionType } from './governanceAdvisor';
import { emitIndexRemediationRecord } from '@/features/diagnostics/drift/domain/driftLogic';

export interface GovernanceRepairResult {
  recommendationId: string;
  status: 'success' | 'error';
  actionPerformed: GovernanceActionType;
  errorDetail?: string;
  timestamp: string;
}

/**
 * Executes a governance remediation action.
 * Handles both field creation and index state management based on actual list state.
 */
export async function executeGovernanceRepair(
  sp: Pick<SpListOperations, 'updateField' | 'addFieldToList' | 'getListFieldInternalNames'>,
  recommendation: GovernanceRecommendation
): Promise<GovernanceRepairResult> {
  const { listTitle, targetField, action, id } = recommendation;
  const timestamp = new Date().toISOString();

  try {
    auditLog.info('governance:repair', `Starting repair for ${listTitle}.${targetField}`, { actionType: action.type });

    // 1. Check current state to see if we need to CREATE or just INDEX
    const existingFields = await sp.getListFieldInternalNames(listTitle);
    const fieldExists = existingFields.has(targetField);

    let finalActionLabel: GovernanceActionType = action.type;

    if (!fieldExists) {
      // Action: Create Field
      auditLog.info('governance:repair', `Field ${targetField} missing in ${listTitle}. Creating...`);
      await sp.addFieldToList(listTitle, action.payload);
      finalActionLabel = 'CREATE_FIELD';
    } else {
      // Action: Ensure Index (or remove)
      const isIndexTarget = action.type !== 'DELETE_INDEX';
      auditLog.info('governance:repair', `Ensuring indexed=${isIndexTarget} for ${listTitle}.${targetField}`);
      await sp.updateField(listTitle, targetField, { Indexed: isIndexTarget });
      finalActionLabel = isIndexTarget ? 'ENSURE_INDEX' : 'DELETE_INDEX';
    }

    // 2. Log Telemetry (Reusing existing drift logic for now to maintain dashboard compatibility)
    const telemetryType = finalActionLabel === 'DELETE_INDEX' ? 'delete' : 'create';
    emitIndexRemediationRecord(listTitle, targetField, telemetryType, 'success');

    return {
      recommendationId: id,
      status: 'success',
      actionPerformed: finalActionLabel,
      timestamp,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    auditLog.error('governance:repair', `Repair failed for ${listTitle}.${targetField}`, { detail });
    
    // Error Telemetry
    emitIndexRemediationRecord(listTitle, targetField, 'create', 'error', detail);

    return {
      recommendationId: id,
      status: 'error',
      actionPerformed: action.type,
      errorDetail: detail,
      timestamp,
    };
  }
}
