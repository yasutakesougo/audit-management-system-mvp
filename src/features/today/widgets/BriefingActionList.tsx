/**
 * BriefingActionList — アクション型朝会アラート（Execution Layer）
 *
 * H-3 ガードレール準拠:
 * - MUI <Accordion> を使用（Collapse 置換）
 * - 複数同時展開OK（排他禁止）
 * - 未完了ありなら expanded=true がデフォルト（ユーザー操作で折りたたみ可能）
 * - ヘッダー: 「ブリーフィング」+ 未完了数バッジ
 * - ヘッダー内に複数CTAを置かない
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Badge,
    Box,
    Button,
    Chip,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import React, { useMemo } from 'react';
import {
    ALERT_ACTION_DEFS,
    buildAlertKey,
    useAlertActionState,
    type ActionStatus,
} from '../actions';
import { EmptyStateBlock } from './EmptyStateBlock';
import { toLocalDateISO } from '@/utils/getNow';

export type BriefingActionListProps = {
  alerts: BriefingAlert[];
};

const STATUS_CHIP: Record<ActionStatus, { label: string; color: 'default' | 'warning' | 'success' | 'info' }> = {
  todo: { label: '未対応', color: 'default' },
  doing: { label: '対応中', color: 'warning' },
  done: { label: '完了', color: 'success' },
  snoozed: { label: '後で', color: 'info' },
};

export const BriefingActionList: React.FC<BriefingActionListProps> = ({ alerts }) => {
  const { getState, setState, completionStats } = useAlertActionState();
  const ymd = toLocalDateISO();

  // Pending count across all alerts (for badge display)
  const pendingCount = useMemo(() => {
    return alerts.reduce((acc, alert) => {
      const items = alert.items ?? [];
      const keys = items.map((item) => buildAlertKey(alert.type, item.userId, ymd));
      const stats = completionStats(keys);
      return acc + (stats.total - stats.done);
    }, 0);
  }, [alerts, completionStats, ymd]);

  // Empty state: show completion message instead of null
  if (alerts.length === 0) {
    return (
      <Paper data-testid="today-accordion-briefing" sx={{ p: 2, mb: 3 }}>
        <EmptyStateBlock
          icon={<AssignmentTurnedInIcon />}
          title="ブリーフィング項目はありません"
          description="確認が必要なアラートは発生していません。"
          testId="today-empty-briefing"
        />
      </Paper>
    );
  }

  return (
    <Accordion
      data-testid="today-accordion-briefing"
      defaultExpanded={pendingCount > 0}
      disableGutters
      sx={{
        mb: 3,
        '&::before': { display: 'none' },
        boxShadow: 1,
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ minHeight: 48 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            📋 ブリーフィング
          </Typography>
          {pendingCount > 0 && (
            <Badge
              badgeContent={pendingCount}
              color="warning"
              sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem', minWidth: 20, height: 20 } }}
            />
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails data-testid="today-briefing-actions" sx={{ pt: 0, px: 2, pb: 2 }}>
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
                    {alert.count > 0 && ` (${alert.count}件)`}
                  </Typography>
                </Alert>

                {/* Per-user Action Rows */}
                {items.length > 0 && (
                  <Stack spacing={0.5} sx={{ pl: 2 }}>
                    {items.map((item) => {
                      const key = buildAlertKey(alert.type, item.userId, ymd);
                      const status = getState(key);
                      const chipConfig = STATUS_CHIP[status];

                      return (
                        <Box
                          key={key}
                          data-testid={`alert-action-row-${item.userId}`}
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
                            {item.userName}
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
                              onClick={() => setState(key, 'done')}
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
                    })}
                  </Stack>
                )}

                {/* Fallback: no items (backward compat) */}
                {items.length === 0 && alert.description && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                    {alert.description}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
