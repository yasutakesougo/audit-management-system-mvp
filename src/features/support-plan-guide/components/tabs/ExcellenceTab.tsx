/**
 * ExcellenceTab — 改善メモ・連携タブ
 *
 * SectionKey: 'excellence'
 *
 * Issue #10 Phase 2: ISPCandidateImportSection を組み込み、
 * 行動パターンから生成された ISP 候補を improvementIdeas に取り込む。
 * UX パターンは MonitoringTab のエビデンス引用と統一。
 */
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { ToastState } from '../../types';
import { findSection } from '../../utils/helpers';
import FieldCard from './FieldCard';
import ISPCandidateImportSection from './ISPCandidateImportSection';
import type { SectionTabProps } from './tabProps';

/** ExcellenceTab 固有の Props（MonitoringTab と同じパターン） */
export type ExcellenceTabProps = SectionTabProps & {
  /** 対象利用者の ID（ISP 候補取り込みに必要） */
  userId?: number | string | null;
  /** Toast 表示ハンドラ */
  setToast: (toast: ToastState) => void;
};

const ExcellenceTab: React.FC<ExcellenceTabProps> = ({
  userId,
  setToast,
  ...sectionProps
}) => {
  const section = findSection('excellence');
  if (!section) return null;

  return (
    <Stack spacing={2}>
      {section.description ? (
        <Typography variant="subtitle1" component="span" sx={{ color: 'text.secondary' }}>
          {section.description}
        </Typography>
      ) : null}

      {/* Issue #10 Phase 2: ISP 候補取り込みセクション */}
      {userId != null && (
        <ISPCandidateImportSection
          userId={String(userId)}
          currentImprovementIdeas={sectionProps.form.improvementIdeas}
          onFieldChange={sectionProps.onFieldChange}
          isAdmin={sectionProps.isAdmin}
          setToast={setToast}
        />
      )}

      <Stack spacing={2}>
        {section.fields.map((field) => (
          <FieldCard key={field.key} field={field} {...sectionProps} />
        ))}
      </Stack>
    </Stack>
  );
};

export default React.memo(ExcellenceTab);
