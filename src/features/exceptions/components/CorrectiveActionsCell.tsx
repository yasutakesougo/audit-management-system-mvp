import React from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { DismissSnoozeMenu } from '@/features/action-engine/components/DismissSnoozeMenu';
import { buildCorrectiveActions } from '../domain/correctiveActions';
import type { ExceptionItem } from '../domain/exceptionLogic';
import type { ExceptionTableSuggestionActions } from './ExceptionTable.types';

const SEVERITY_TO_COLOR: Record<
  string,
  'error' | 'warning' | 'primary' | 'inherit'
> = {
  critical: 'error',
  high: 'warning',
  medium: 'primary',
  low: 'inherit',
};

type CorrectiveActionsCellProps = {
  item: ExceptionItem;
  onNavigate: (route: string) => void;
  suggestionActions?: ExceptionTableSuggestionActions;
};

export const CorrectiveActionsCell: React.FC<CorrectiveActionsCellProps> = ({
  item,
  onNavigate,
  suggestionActions,
}) => {
  const actions = buildCorrectiveActions(item);
  const primary = actions.find((a) => a.variant === 'primary');
  const secondary = actions.find(
    (a) => a.variant === 'secondary' || a.variant === 'ghost',
  );
  const stableId = item.stableId;
  const canOpenSuggestionMenu = Boolean(
    item.category === 'corrective-action' && stableId && suggestionActions,
  );

  const handleNavigate = (route: string) => {
    if (item.category === 'corrective-action' && stableId) {
      suggestionActions?.onCtaClick?.(stableId, route, 'table');
    }
    onNavigate(route);
  };

  if (!primary) return null;

  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Button
          size="small"
          variant="contained"
          color={SEVERITY_TO_COLOR[primary.severity] ?? 'primary'}
          onClick={() => handleNavigate(primary.route)}
          startIcon={<span style={{ fontSize: 12 }}>{primary.icon}</span>}
          sx={{ fontSize: '0.7rem', textTransform: 'none', py: 0.25, px: 1 }}
          title={primary.reason}
          data-testid={`corrective-primary-${item.id}`}
        >
          {primary.label}
        </Button>
        {canOpenSuggestionMenu && stableId && suggestionActions && (
          <DismissSnoozeMenu
            buttonAriaLabel="改善提案メニュー"
            buttonTestId={`suggestion-menu-button-${item.id}`}
            onDismiss={() => suggestionActions.onDismiss(stableId)}
            onSnooze={(preset) => suggestionActions.onSnooze(stableId, preset)}
          />
        )}
      </Stack>

      {secondary && (
        <Button
          size="small"
          variant="text"
          onClick={() => handleNavigate(secondary.route)}
          sx={{
            fontSize: '0.65rem',
            textTransform: 'none',
            color: 'text.secondary',
            py: 0,
            px: 0.5,
            minHeight: 'auto',
          }}
          title={secondary.reason}
          data-testid={`corrective-secondary-${item.id}`}
        >
          {secondary.icon} {secondary.label}
        </Button>
      )}
    </Stack>
  );
};
