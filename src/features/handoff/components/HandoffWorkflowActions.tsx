/**
 * HandoffWorkflowActions — 会議モード別ワークフローアクションボタン
 *
 * Phase 2 (B-1): HandoffItem.tsx から分割。
 * A-2 で Pure 化した handoffActions.ts を利用。
 */

import { Box, Button, Stack } from '@mui/material';
import React, { useState } from 'react';
import { motionTokens } from '@/app/theme';
import { getAvailableActionButtons, shouldShowWorkflowActions } from '../domain/handoffActions';
import type { HandoffStatus, MeetingMode } from '../handoffTypes';
import type { WorkflowActions } from '../useHandoffTimelineViewModel';

// ────────────────────────────────────────────────────────────

export type HandoffWorkflowActionsProps = {
  handoffId: number;
  title: string;
  status: HandoffStatus;
  meetingMode: MeetingMode;
  workflowActions: WorkflowActions;
};

export const HandoffWorkflowActions: React.FC<HandoffWorkflowActionsProps> = React.memo(({
  handoffId,
  title,
  status,
  meetingMode,
  workflowActions,
}) => {
  const [isSaving, setIsSaving] = useState(false);

  if (!shouldShowWorkflowActions(meetingMode, status)) {
    return null;
  }

  const buttons = getAvailableActionButtons(status, meetingMode);

  if (buttons.length === 0) {
    return null;
  }

  const handleAction = async (targetStatus: HandoffStatus) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (targetStatus === '確認済') await workflowActions.markReviewed(handoffId);
      else if (targetStatus === '明日へ持越') await workflowActions.markCarryOver(handoffId);
      else if (targetStatus === '完了' || targetStatus === '対応済') await workflowActions.markClosed(handoffId);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={1}>
        {buttons.map((btn) => (
          <Button
            key={btn.key}
            size="small"
            variant="outlined"
            color={btn.color}
            disabled={isSaving}
            onClick={() => handleAction(btn.nextStatus)}
            aria-label={`${btn.label}: ${title}`}
            sx={{
              minWidth: 48,
              minHeight: 44,
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: 2,
              transition: motionTokens.transition.hoverAll,
              '&:active': { transform: 'scale(0.97)' },
            }}
          >
            {btn.emoji} {btn.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
});

HandoffWorkflowActions.displayName = 'HandoffWorkflowActions';
