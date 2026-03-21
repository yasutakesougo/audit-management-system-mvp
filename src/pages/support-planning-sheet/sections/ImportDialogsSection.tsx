import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import type { PlanningIntake, PlanningSheetFormValues } from '@/domain/isp/schema';
import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';
import type { UserAssessment } from '@/features/assessment/domain/types';
import {
  ImportAssessmentDialog,
} from '@/features/planning-sheet/components/ImportAssessmentDialog';
import {
  ImportMonitoringDialog,
} from '@/features/planning-sheet/components/ImportMonitoringDialog';
import type { AssessmentBridgeResult } from '@/features/planning-sheet/assessmentBridge';
import type { MonitoringToPlanningResult } from '@/features/planning-sheet/monitoringToPlanningBridge';
import { TOAST_AUTO_HIDE_DURATION_MS } from '../constants';

type ToastState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

type ImportDialogsSectionProps = {
  toast: ToastState;
  onCloseToast: () => void;
  currentAssessment: UserAssessment | null;
  importDialogOpen: boolean;
  onCloseImportDialog: () => void;
  targetUserName?: string;
  formValues: PlanningSheetFormValues;
  formIntake: PlanningIntake;
  onImportAssessment: (result: AssessmentBridgeResult) => void;
  latestMonitoringRecord: BehaviorMonitoringRecord | null;
  monitoringDialogOpen: boolean;
  onCloseMonitoringDialog: () => void;
  onImportMonitoring: (
    result: MonitoringToPlanningResult,
    selectedCandidateIds: string[],
  ) => void;
};

export function ImportDialogsSection({
  toast,
  onCloseToast,
  currentAssessment,
  importDialogOpen,
  onCloseImportDialog,
  targetUserName,
  formValues,
  formIntake,
  onImportAssessment,
  latestMonitoringRecord,
  monitoringDialogOpen,
  onCloseMonitoringDialog,
  onImportMonitoring,
}: ImportDialogsSectionProps) {
  return (
    <>
      <Snackbar
        open={toast.open}
        autoHideDuration={TOAST_AUTO_HIDE_DURATION_MS}
        onClose={onCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} onClose={onCloseToast} variant="filled">
          {toast.message}
        </Alert>
      </Snackbar>

      {currentAssessment && (
        <ImportAssessmentDialog
          open={importDialogOpen}
          onClose={onCloseImportDialog}
          assessment={currentAssessment}
          targetUserName={targetUserName}
          currentForm={formValues}
          currentIntake={formIntake}
          onImport={onImportAssessment}
        />
      )}

      {latestMonitoringRecord && (
        <ImportMonitoringDialog
          open={monitoringDialogOpen}
          onClose={onCloseMonitoringDialog}
          monitoringRecord={latestMonitoringRecord}
          currentForm={formValues}
          onImport={onImportMonitoring}
        />
      )}
    </>
  );
}
