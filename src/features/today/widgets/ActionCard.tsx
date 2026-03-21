import React from 'react';
import { Box, Typography, Chip, IconButton, useTheme, alpha } from '@mui/material';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import LaunchIcon from '@mui/icons-material/Launch';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import type { SnoozePreset } from '@/features/action-engine/domain/computeSnoozeUntil';
import { DismissSnoozeMenu } from '@/features/action-engine/components/DismissSnoozeMenu';

import type { ActionCard as IActionCard, ActionPriority, ActionType } from '../domain/models/queue.types';

export interface ActionCardProps {
  action: IActionCard;
  onClick?: (action: IActionCard) => void;
  onDismissSuggestion?: (stableId: string) => void;
  onSnoozeSuggestion?: (stableId: string, preset: SnoozePreset) => void;
}

const PRIORITY_STYLES: Record<ActionPriority, { color: string; label: string }> = {
  P0: { color: '#d32f2f', label: '最優先 (P0)' },   // error
  P1: { color: '#ed6c02', label: '高優先 (P1)' },   // warning
  P2: { color: '#0288d1', label: '低優先 (P2)' },   // info
  P3: { color: '#9e9e9e', label: '定常 (P3)' }      // grey
};

const ACTION_ICONS: Record<ActionType, React.ReactNode> = {
  OPEN_DRAWER: <LaunchIcon fontSize="small" />,
  NAVIGATE: <LaunchIcon fontSize="small" />,
  ACKNOWLEDGE: <AssignmentLateIcon fontSize="small" />,
};

function extractSuggestionStableId(action: IActionCard): string | null {
  if (!action.id.startsWith('corrective:')) return null;
  const payload = action.payload as { suggestion?: { stableId?: string } } | undefined;
  return payload?.suggestion?.stableId ?? action.id.replace(/^corrective:/, '');
}

export const ActionCard: React.FC<ActionCardProps> = ({
  action,
  onClick,
  onDismissSuggestion,
  onSnoozeSuggestion,
}) => {
  const theme = useTheme();
  const priorityStyle = PRIORITY_STYLES[action.priority];
  const isCritical = action.priority === 'P0';
  const stableId = extractSuggestionStableId(action);
  const canOpenSuggestionMenu = Boolean(stableId && (onDismissSuggestion || onSnoozeSuggestion));

  return (
    <Box
      onClick={() => onClick?.(action)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 2,
        mb: 1.5,
        borderRadius: 2,
        border: `1px solid ${alpha(priorityStyle.color, 0.4)}`,
        bgcolor: isCritical ? alpha(priorityStyle.color, 0.05) : 'background.paper',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': {
          bgcolor: alpha(priorityStyle.color, 0.1),
          borderColor: priorityStyle.color,
          transform: 'translateY(-2px)'
        }
      }}
      data-testid={`action-card-${action.id}`}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        {/* Source Icon Segment */}
        <Box sx={{ color: priorityStyle.color, display: 'flex', alignItems: 'center' }}>
          {ACTION_ICONS[action.actionType]}
        </Box>

        {/* Content Segment */}
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {action.title}
            </Typography>
            <Chip 
              label={priorityStyle.label} 
              size="small" 
              sx={{ 
                height: 20, 
                fontSize: '0.65rem', 
                bgcolor: priorityStyle.color, 
                color: '#fff',
                fontWeight: 'bold',
                ...(isCritical && { animation: 'pulse 1.5s infinite' })
              }} 
            />
            {action.isOverdue && (
              <Chip
                label="超過"
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: theme.palette.error.main,
                  color: '#fff',
                  fontWeight: 'bold'
                }}
              />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {action.contextMessage}
          </Typography>
        </Box>
      </Box>

      {/* Action CTA Segment */}
      {canOpenSuggestionMenu && stableId ? (
        <DismissSnoozeMenu
          buttonAriaLabel="改善提案メニュー"
          buttonTestId={`suggestion-menu-button-${action.id}`}
          onDismiss={() => onDismissSuggestion?.(stableId)}
          onSnooze={(preset) => onSnoozeSuggestion?.(stableId, preset)}
        />
      ) : (
        <IconButton
          size="small"
          sx={{
            color: priorityStyle.color,
            bgcolor: alpha(priorityStyle.color, 0.1),
            '&:hover': { bgcolor: alpha(priorityStyle.color, 0.2) }
          }}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(action);
          }}
        >
          <CheckBoxOutlinedIcon />
        </IconButton>
      )}
    </Box>
  );
};
