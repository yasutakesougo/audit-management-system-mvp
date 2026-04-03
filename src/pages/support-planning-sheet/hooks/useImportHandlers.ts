import React from 'react';
import type { UserAssessment } from '@/features/assessment/domain/types';
import type { AssessmentBridgeResult, ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';
import type { MonitoringToPlanningResult } from '@/features/planning-sheet/monitoringToPlanningBridge';
import type { ImportAuditRecord } from '@/features/planning-sheet/stores/importAuditStore';
import type { UsePlanningSheetFormReturn } from '@/features/planning-sheet/hooks/usePlanningSheetForm';
import type { MonitoringToPlanningBridge } from '@/domain/isp/bridge';
import type { PlanningSheetFormValues } from '@/domain/isp/schema';
import type { ToastState } from './useSupportPlanningSheetUiState';

type SaveAuditRecordFn = (params: Omit<ImportAuditRecord, 'id'>) => ImportAuditRecord;

type UseImportHandlersParams = {
  form: UsePlanningSheetFormReturn;
  planningSheetId: string | undefined;
  currentAssessment: UserAssessment | null;
  account: { name?: string } | null | undefined;
  saveAuditRecord: SaveAuditRecordFn;
  setToast: React.Dispatch<React.SetStateAction<ToastState>>;
  setSessionProvenance: React.Dispatch<React.SetStateAction<ProvenanceEntry[]>>;
};

export function useImportHandlers({
  form,
  planningSheetId,
  currentAssessment,
  account,
  saveAuditRecord,
  setToast,
  setSessionProvenance,
}: UseImportHandlersParams) {
  const handleAssessmentImport = React.useCallback((result: AssessmentBridgeResult) => {
    if (result.formPatches.observationFacts !== undefined) {
      form.setFieldValue('observationFacts', result.formPatches.observationFacts);
    }
    if (result.formPatches.collectedInformation !== undefined) {
      form.setFieldValue('collectedInformation', result.formPatches.collectedInformation);
    }
    if (result.intakePatches.sensoryTriggers || result.intakePatches.medicalFlags) {
      form.setIntake({
        ...form.intake,
        ...(result.intakePatches.sensoryTriggers && { sensoryTriggers: result.intakePatches.sensoryTriggers }),
        ...(result.intakePatches.medicalFlags && { medicalFlags: result.intakePatches.medicalFlags }),
      });
    }

    const parts: string[] = [];
    if (result.summary.sensoryTriggersAdded > 0) parts.push(`感覚トリガー${result.summary.sensoryTriggersAdded}件`);
    if (result.summary.observationFactsAppended) parts.push('行動観察');
    if (result.summary.collectedInfoAppended) parts.push('収集情報');
    if (result.summary.medicalFlagsAdded > 0) parts.push(`医療フラグ${result.summary.medicalFlagsAdded}件`);
    const summaryText = `アセスメントから取込完了: ${parts.join('、')}`;
    setToast({ open: true, message: summaryText, severity: 'success' });
    setSessionProvenance((prev) => [...prev, ...result.provenance]);

    if (planningSheetId && currentAssessment) {
      const affectedFields = [...new Set(result.provenance.map((item) => item.field))];
      saveAuditRecord({
        planningSheetId,
        importedAt: new Date().toISOString(),
        importedBy: account?.name ?? '不明',
        assessmentId: currentAssessment.id,
        tokuseiResponseId: null,
        mode: result.provenance.some((item) => item.source === 'tokusei_survey') ? 'with-tokusei' : 'assessment-only',
        affectedFields,
        provenance: result.provenance,
        summaryText,
      });
    }
  }, [account?.name, currentAssessment, form, planningSheetId, saveAuditRecord, setSessionProvenance, setToast]);

  const handleMonitoringImport = React.useCallback((
    result: MonitoringToPlanningResult,
    selectedCandidateIds: string[],
  ) => {
    for (const [field, value] of Object.entries(result.autoPatches)) {
      if (value !== undefined) {
        form.setFieldValue(field as keyof typeof form.values, value as string);
      }
    }

    const selectedCandidates = result.candidates.filter((candidate) =>
      selectedCandidateIds.includes(candidate.id),
    );

    for (const candidate of selectedCandidates) {
      const current = form.values[candidate.targetField] ?? '';
      const currentStr = typeof current === 'string' ? current : String(current);
      if (!currentStr.includes(candidate.text.slice(0, 30))) {
        const updated = currentStr ? `${currentStr}\n\n${candidate.text}` : candidate.text;
        form.setFieldValue(candidate.targetField, updated);
      }
    }

    setSessionProvenance((prev) => [...prev, ...result.provenance]);

    const parts: string[] = [];
    if (result.summary.autoFieldCount > 0) parts.push(`自動追記${result.summary.autoFieldCount}件`);
    if (selectedCandidates.length > 0) parts.push(`候補反映${selectedCandidates.length}件`);
    const summaryText = `行動モニタリングから反映完了: ${parts.join('、') || '変更なし'}`;
    setToast({ open: true, message: summaryText, severity: 'success' });

    if (planningSheetId) {
      const affectedFields = [...new Set(result.provenance.map((item) => item.field))];
      saveAuditRecord({
        planningSheetId,
        importedAt: new Date().toISOString(),
        importedBy: account?.name ?? '不明',
        assessmentId: null,
        tokuseiResponseId: null,
        mode: 'behavior-monitoring',
        affectedFields,
        provenance: result.provenance,
        summaryText,
      });
    }
  }, [account?.name, form, planningSheetId, saveAuditRecord, setSessionProvenance, setToast]);

  const handleReflectCandidate = React.useCallback((
    bridge: MonitoringToPlanningBridge,
    candidateId: string,
  ) => {
    const candidate = bridge.candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    // Mapping bridge candidate type to form field
    const fieldMap: Record<string, keyof PlanningSheetFormValues> = {
      observation: 'observationFacts',
      hypothesis: 'collectedInformation',
      environmental: 'environmentalAdjustments',
      strategy: 'concreteApproaches',
      risk: 'observationFacts',
    };

    const targetField = fieldMap[candidate.type] ?? 'concreteApproaches';
    
    const current = form.values[targetField] ?? '';
    const currentStr = typeof current === 'string' ? current : String(current);

    // Simple deduplication check
    if (currentStr.includes(candidate.content.slice(0, 30))) {
      setToast({ open: true, message: 'この内容は既に反映されています', severity: 'info' });
      return;
    }

    const updated = currentStr ? `${currentStr}\n\n${candidate.content}` : candidate.content;
    form.setFieldValue(targetField as keyof PlanningSheetFormValues, updated);

    setToast({ open: true, message: `「${candidate.type}」の提案を反映しました`, severity: 'success' });

    // Optional: Record persistent audit if needed
  }, [form, setToast]);

  return {
    handleAssessmentImport,
    handleMonitoringImport,
    handleReflectCandidate,
  };
}
