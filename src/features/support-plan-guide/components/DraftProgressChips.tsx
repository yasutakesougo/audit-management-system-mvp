import React from 'react';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import { SupportPlanDraft } from '../types';
import { computeRequiredCompletion } from '../domain/progress';

interface DraftProgressChipsProps {
  drafts: SupportPlanDraft[];
  activeDraftId: string | null;
  onSelectDraft: (id: string) => void;
}

export const DraftProgressChips: React.FC<DraftProgressChipsProps> = ({
  drafts,
  activeDraftId,
  onSelectDraft,
}) => {
  return (
    <>
      {drafts.map((draft) => {
        const progress = computeRequiredCompletion(draft.data);
        const lastUpdated = draft.updatedAt ? new Date(draft.updatedAt).toLocaleString('ja-JP') : '未記録';
        const displayName = draft.name.trim() || '未設定の利用者';
        const code = draft.userCode?.trim();
        const chipLabel = `${displayName}${code ? ` / ${code}` : ''} (${progress}%)`;
        const tooltipParts = [`必須達成: ${progress}%`, `最終更新: ${lastUpdated}`];
        if (code) {
          tooltipParts.push(`利用者コード: ${code}`);
        }
        if (draft.userId != null) {
          tooltipParts.push(`レコードID: ${draft.userId}`);
        }
        const linkedToMaster = draft.userId != null;

        return (
          <Tooltip key={draft.id} title={tooltipParts.join(' ・ ')} arrow>
            <Chip
              icon={linkedToMaster ? <VerifiedUserRoundedIcon fontSize="small" /> : undefined}
              clickable
              color={draft.id === activeDraftId ? 'primary' : 'default'}
              label={chipLabel}
              onClick={() => onSelectDraft(draft.id)}
            />
          </Tooltip>
        );
      })}
    </>
  );
};
