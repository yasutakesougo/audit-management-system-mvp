import { useCallback } from 'react';
import type { PlanPatch } from '@/domain/isp/planPatch';
import { applyPlanPatch } from '@/domain/isp/planPatch';
import { recordAudit, OrchestratorFailureKind } from '@/lib/telemetry/auditLogger';
import type { PlanPatchRepository } from '@/domain/isp/planPatchRepository';
import type { PlanningSheetRepository } from '@/domain/isp/port';
import type { PlanningSheetUpdateInput } from '@/domain/isp/port';
import type { SupportPlanningSheet } from '@/domain/isp/schema';

export interface PlanningSheetOrchestratorDeps {
  planningSheetRepo: PlanningSheetRepository;
  planPatchRepo: PlanPatchRepository;
  showSnack: (severity: 'success' | 'error' | 'info', message: string) => void;
  refresh: () => Promise<void>;
}

const toPlanningSheetUpdateInput = (
  sheet: SupportPlanningSheet,
): PlanningSheetUpdateInput => {
  const normalizeNullableIso = (value: string | null | undefined): string | undefined =>
    typeof value === 'string' && value.trim() ? value : undefined;

  return {
    ...sheet,
    appliedFrom: normalizeNullableIso(sheet.appliedFrom),
    nextReviewAt: normalizeNullableIso(sheet.nextReviewAt),
    supportStartDate: normalizeNullableIso(sheet.supportStartDate),
    authoredAt: normalizeNullableIso(sheet.authoredAt),
  };
};

/**
 * usePlanningSheetOrchestrator
 * 
 * 支援計画書の更新業務（更新案の適用など）を調整する Orchestrator。
 */
export function usePlanningSheetOrchestrator(deps: PlanningSheetOrchestratorDeps) {
  const { planningSheetRepo, planPatchRepo, showSnack, refresh } = deps;

  /**
   * 更新案（Patch）を支援計画書に適用する
   */
  const handleApplyPatch = useCallback(async (patch: PlanPatch, currentSheet: SupportPlanningSheet) => {
    const startTime = performance.now();
    try {
      // 1. ドメインロジックによるパッチ適用（純粋関数）
      const updated = applyPlanPatch(patch, currentSheet);
      const updateInput = toPlanningSheetUpdateInput(updated);
      
      // 2. 支援計画書の更新
      await planningSheetRepo.update(currentSheet.id, updateInput);
      
      // 3. 更新案のステータスを「確定」に変更
      await planPatchRepo.updateStatus(patch.id, 'confirmed');
      
      recordAudit({
        action: 'APPLY_PLANNING_PATCH',
        targetId: currentSheet.id,
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        metadata: { patchId: patch.id }
      });

      showSnack('success', '更新案を支援計画シートへ反映しました。');
      await refresh();
      
    } catch (e) {
      const durationMs = performance.now() - startTime;
      const message = e instanceof Error ? e.message : '更新案の反映に失敗しました';
      
      let kind = OrchestratorFailureKind.UNKNOWN;
      if (message.includes('VERSION_CONFLICT')) kind = OrchestratorFailureKind.CONFLICT;

      recordAudit({
        action: 'APPLY_PLANNING_PATCH',
        targetId: currentSheet.id,
        status: 'FAILURE',
        durationMs,
        error: { kind, message }
      });

      if (kind === OrchestratorFailureKind.CONFLICT) {
        showSnack('error', 'バージョン競合が発生しました。最新の計画書を確認してから再適用してください。');
      } else {
        showSnack('error', '更新案の反映に失敗しました。');
      }
      throw e;
    }
  }, [planningSheetRepo, planPatchRepo, showSnack, refresh]);

  /**
   * 更新案のステータスを変更する（保留、差し戻し等）
   */
  const handleUpdatePatchStatus = useCallback(async (patchId: string, status: PlanPatch['status']) => {
    const startTime = performance.now();
    try {
      await planPatchRepo.updateStatus(patchId, status);
      
      recordAudit({
        action: 'UPDATE_PATCH_STATUS',
        targetId: patchId,
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        metadata: { status }
      });

      showSnack('info', `ステータスを「${status}」に変更しました。`);
      await refresh();
    } catch (e) {
      const durationMs = performance.now() - startTime;
      recordAudit({
        action: 'UPDATE_PATCH_STATUS',
        targetId: patchId,
        status: 'FAILURE',
        durationMs,
        error: { kind: OrchestratorFailureKind.UNKNOWN, message: e instanceof Error ? e.message : 'failed' }
      });
      showSnack('error', 'ステータスの変更に失敗しました。');
      throw e;
    }
  }, [planPatchRepo, showSnack, refresh]);

  return {
    handleApplyPatch,
    handleUpdatePatchStatus,
  };
}
