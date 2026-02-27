/**
 * BriefingActionList — アクション型朝会アラート（Execution Layer）
 *
 * 従来の BriefingAlertList を "行動リスト" に進化。
 * 各アラートをグループヘッダー + per-user アクション行に分解。
 *
 * @optimized react-best-practices:
 *   - rerender-memo: ActionRow を React.memo 化（親 state 変更時の再レンダー防止）
 *   - rerender-functional-setstate: onClick を useCallback で安定化
 *   - rendering-conditional-render: && → ternary（falsy 0 防止）
 *   - js-cache-function-results: ymd を useMemo でキャッシュ
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback } from 'react';
import {
  ALERT_ACTION_DEFS,
  buildAlertKey,
  useAlertActionState,
  type ActionStatus,
} from '../actions';
import { logBriefingAction } from '../actions/alertActions.logger';

export type BriefingActionListProps = {
  alerts: BriefingAlert[];
};

// --- Hoisted constants (rendering-hoist-jsx) ---

const STATUS_CHIP: Record<ActionStatus, { label: string; color: 'default' | 'warning' | 'success' | 'info' }> = {
  todo: { label: '未対応', color: 'default' },
  doing: { label: '対応中', color: 'warning' },
  done: { label: '完了', color: 'success' },
  snoozed: { label: '後で', color: 'info' },
};

// --- Memoized sub-component (rerender-memo) ---

type ActionRowProps = {
  alertKey: string;
  userId: string;
  userName: string;
  status: ActionStatus;
  actionDefs: { id: string; label: string; primary?: boolean }[];
  /** key + actionId を渡す。親側で actionId に応じた state 遷移を判断する */
  onAction: (key: string, actionId: string) => void;
};

const ActionRow = React.memo<ActionRowProps>(function ActionRow({
  alertKey,
  userId,
  userName,
  status,
  actionDefs,

  onAction,
}) {
  const chipConfig = STATUS_CHIP[status];

  return (
    <Box
      data-testid={`alert-action-row-${userId}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.5,
        px: 1,
        borderRadius: 1,
        bgcolor: status === 'done' ? 'action.hover' : 'transparent',
        opacity: status === 'done' ? 0.7 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          textDecoration: status === 'done' ? 'line-through' : 'none',
        }}
      >
        {userName}
      </Typography>

      <Chip
        size="small"
        label={chipConfig.label}
        color={chipConfig.color}
        variant="filled"
        sx={{ minWidth: 56 }}
      />

      {actionDefs.map((action) => (
        <Button
          key={action.id}
          size="small"
          variant={action.primary ? 'contained' : 'text'}
          disabled={status === 'done'}
          onClick={() => onAction(alertKey, action.id)}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            minWidth: 'auto',
            px: 1,
          }}
        >
          {action.label}
        </Button>
      ))}
    </Box>
  );
});

// --- Main component ---

export const BriefingActionList: React.FC<BriefingActionListProps> = ({ alerts }) => {
  const { getState, setState, completionStats, ymd } = useAlertActionState();

  // rerender-functional-setstate: stable callback ref
  // actionId に応じた state 遷移 + observability event
  const handleAction = useCallback(
    (key: string, actionId: string) => {
      // Determine next status from actionId
      const nextStatus = actionId.includes('snooze') ? 'snoozed' as const : 'done' as const;
      const { prevStatus } = setState(key, nextStatus);

      // Parse alertKey → alertType:userId:ymd
      const [alertType = 'unknown', userId = 'unknown'] = key.split(':');

      // @observability-engineer: structured event
      logBriefingAction({
        ymd,
        alertType,
        userId,
        actionId,
        prevStatus,
        nextStatus,
        source: 'BriefingActionList',
      });
    },
    [setState, ymd],
  );

  return (
    <Collapse in={alerts.length > 0}>
      <Paper data-testid="today-briefing-actions" sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2}>
          {alerts.map((alert) => {
            const items = alert.items ?? [];
            const alertKeys = items.map((item) =>
              buildAlertKey(alert.type, item.userId, ymd),
            );
            const stats = completionStats(alertKeys);
            const actionDefs = ALERT_ACTION_DEFS[alert.type] ?? [];

            return (
              <Box key={alert.id}>
                {/* Group Header */}
                <Alert
                  severity={alert.severity}
                  variant="outlined"
                  sx={{ py: 0.25, mb: 1 }}
                  action={
                    items.length > 0 ? (
                      <Chip
                        size="small"
                        label={`${stats.done}/${stats.total} 完了`}
                        color={stats.done === stats.total && stats.total > 0 ? 'success' : 'default'}
                        variant="outlined"
                      />
                    ) : undefined
                  }
                >
                  <Typography variant="body2" fontWeight={600}>
                    {alert.label}
                    {alert.count > 0 ? ` (${alert.count}件)` : null}
                  </Typography>
                </Alert>

                {/* Per-user Action Rows (rendering-conditional-render: ternary) */}
                {items.length > 0 ? (
                  <Stack spacing={0.5} sx={{ pl: 2 }}>
                    {items.map((item) => {
                      const key = buildAlertKey(alert.type, item.userId, ymd);
                      return (
                        <ActionRow
                          key={key}
                          alertKey={key}
                          userId={item.userId}
                          userName={item.userName}
                          status={getState(key)}
                          actionDefs={actionDefs}
                          onAction={handleAction}
                        />
                      );
                    })}
                  </Stack>
                ) : (
                  // Fallback: no items (backward compat)
                  alert.description ? (
                    <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                      {alert.description}
                    </Typography>
                  ) : null
                )}
              </Box>
            );
          })}
        </Stack>
      </Paper>
    </Collapse>
  );
};
