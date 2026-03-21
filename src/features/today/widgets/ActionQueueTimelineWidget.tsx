import React from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { ActionCard } from './ActionCard';
import type { SnoozePreset } from '@/features/action-engine/domain/computeSnoozeUntil';
import type { ActionCard as IActionCard } from '../domain/models/queue.types';

export interface ActionQueueTimelineWidgetProps {
  actionQueue: IActionCard[];
  isLoading: boolean;
  onActionClick?: (action: IActionCard) => void;
  onDismissSuggestion?: (stableId: string) => void;
  onSnoozeSuggestion?: (stableId: string, preset: SnoozePreset) => void;
}

export const ActionQueueTimelineWidget: React.FC<ActionQueueTimelineWidgetProps> = ({
  actionQueue,
  isLoading,
  onActionClick,
  onDismissSuggestion,
  onSnoozeSuggestion,
}) => {
  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={80} sx={{ mb: 1.5, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={80} sx={{ mb: 1.5, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (actionQueue.length === 0) {
    return (
      <Box
        sx={{
          py: 6,
          textAlign: 'center',
          borderRadius: 2,
          bgcolor: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <CheckCircleOutlineIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
        <Typography variant="body1" color="text.secondary" fontWeight="bold">
          現在の待機アクションはありません
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
          すべての業務が完了しているか、直近のタスクがありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      {actionQueue.map((action) => (
        <ActionCard 
          key={action.id} 
          action={action} 
          onClick={onActionClick}
          onDismissSuggestion={onDismissSuggestion}
          onSnoozeSuggestion={onSnoozeSuggestion}
        />
      ))}
    </Box>
  );
};
