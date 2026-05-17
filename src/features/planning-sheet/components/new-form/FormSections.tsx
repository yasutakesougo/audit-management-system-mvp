import React from 'react';
import type { FormState } from './types';
import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { AbcEvidenceListPanelProps } from '@/features/monitoring/components/AbcEvidenceListPanel';

import { SectionBasicAndTarget } from './sections/SectionBasicAndTarget';
import { SectionAnalysisAndFba } from './sections/SectionAnalysisAndFba';
import { SectionPBSStrategies } from './sections/SectionPBSStrategies';
import { SectionMonitoring } from './sections/SectionMonitoring';
import { SectionSharing } from './sections/SectionSharing';

interface FormSectionsProps {
  step: number;
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  renderProvenanceBadge: (fieldKey: string) => React.ReactNode;
  userId?: string;
  isAdmin?: boolean;
  abcEvidenceRecords?: AbcRecord[];
  abcEvidenceLoading?: boolean;
  abcEvidencePeriod?: AbcEvidenceListPanelProps['period'];
  abcEvidenceError?: Error | null;
}

export const FormSections: React.FC<FormSectionsProps> = ({
  step,
  form,
  updateField,
  renderProvenanceBadge,
  userId,
  isAdmin = true,
  abcEvidenceRecords = [],
  abcEvidenceLoading = false,
  abcEvidencePeriod = null,
  abcEvidenceError = null,
}) => {
  switch (step) {
    case 0: // §1 基本情報
    case 1: // §2 対象行動
      return (
        <SectionBasicAndTarget
          step={step}
          form={form}
          updateField={updateField}
        />
      );

    case 2: // §3 氷山分析
    case 3: // §4 FBA
      return (
        <SectionAnalysisAndFba
          step={step}
          form={form}
          updateField={updateField}
          renderProvenanceBadge={renderProvenanceBadge}
        />
      );

    case 4: // §5 予防的支援
    case 5: // §6 代替行動
    case 6: // §7 問題行動時対応
    case 7: // §8 危機対応
      return (
        <SectionPBSStrategies
          step={step}
          form={form}
          updateField={updateField}
        />
      );

    case 8: // §9 モニタリング
      return (
        <SectionMonitoring
          form={form}
          updateField={updateField}
          userId={userId}
          isAdmin={isAdmin}
          abcEvidenceRecords={abcEvidenceRecords}
          abcEvidenceLoading={abcEvidenceLoading}
          abcEvidencePeriod={abcEvidencePeriod}
          abcEvidenceError={abcEvidenceError}
        />
      );

    case 9: // §10 チーム共有
      return (
        <SectionSharing
          form={form}
          updateField={updateField}
        />
      );

    default:
      return null;
  }
};

export default FormSections;
