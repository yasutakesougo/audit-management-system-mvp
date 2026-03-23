import Alert from '@mui/material/Alert';

import { AbcEvidencePanel } from '@/features/ibd/analysis/pdca/components/AbcEvidencePanel';
import { ProvenancePanel } from '@/features/planning-sheet/components/ProvenanceBadge';
import type { ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';

type PlanningStatusSectionProps = {
  userId: string;
  isEditing: boolean;
  validationErrors: Record<string, string | undefined>;
  provenanceEntries: ProvenanceEntry[];
};

export function PlanningStatusSection({
  userId,
  isEditing,
  validationErrors,
  provenanceEntries,
}: PlanningStatusSectionProps) {
  return (
    <>
      <AbcEvidencePanel userId={userId} />

      {isEditing && Object.keys(validationErrors).length > 0 && (
        <Alert severity="warning" variant="outlined">
          入力にエラーがあります: {Object.values(validationErrors).filter(Boolean).join(' / ')}
        </Alert>
      )}

      {isEditing && provenanceEntries.length > 0 && (
        <ProvenancePanel entries={provenanceEntries} defaultExpanded={false} />
      )}
    </>
  );
}
