/**
 * BriefingActionList — 二層型朝会ブリーフィング（Execution Layer）
 *
 * 「今日の共有事項」と「最近の引き継ぎ要点」を分離表示。
 * 常勤/非常勤どちらにも分かりやすい共有構造を提供する。
 *
 * H-3 ガードレール準拠:
 * - MUI <Accordion> を使用
 * - 未完了ありなら expanded=true がデフォルト
 * - セクション内で完了チェック体験を維持
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import { motionTokens } from '@/app/theme';
import type { BriefingAlert, BriefingTag } from '@/features/dashboard/sections/types';
import { toLocalDateISO } from '@/utils/getNow';
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
    Snackbar,
    Stack,
    Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ALERT_ACTION_DEFS,
    buildAlertKey,
    useAlertActionState,
    type ActionStatus,
} from '../actions';
import { EmptyStateBlock } from './EmptyStateBlock';

export type BriefingActionListProps = {
  alerts: BriefingAlert[];
};

const STATUS_CHIP: Record<ActionStatus, { label: string; color: 'default' | 'warning' | 'success' | 'info' }> = {
  todo: { label: '未対応', color: 'default' },
  doing: { label: '対応中', color: 'warning' },
  done: { label: '完了', color: 'success' },
  snoozed: { label: '後で', color: 'info' },
};

const TAG_CHIP: Record<BriefingTag, { color: 'error' | 'warning' | 'info' | 'default'; variant: 'filled' | 'outlined' }> = {
  '重要': { color: 'error', variant: 'filled' },
  '新規': { color: 'info', variant: 'filled' },
  '継続': { color: 'warning', variant: 'outlined' },
  '今週の変更': { color: 'default', variant: 'outlined' },
};

// ─── Section Renderer ────────────────────────────────────────

function AlertSection({
  title,
  emoji,
  alerts,
  getState,
  onAction,
  completionStats,
  ymd,
}: {
  title: string;
  emoji: string;
  alerts: BriefingAlert[];
  getState: (key: string) => ActionStatus;
  onAction: (actionId: string, alertKey: string, userName: string) => void;
  completionStats: (keys: string[]) => { done: number; total: number };
  ymd: string;
}) {
  if (alerts.length === 0) {
    return (
      <Box sx={{ py: 1.5, px: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          {title}はありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'text.secondary',
          fontSize: '0.75rem',
          mb: 1,
        }}
      >
        {emoji} {title}
      </Typography>
      <Stack spacing={1.5}>
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
                sx={{ py: 0.25, mb: 0.5 }}
                action={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {/* Tags */}
                    {alert.tags?.map((tag) => {
                      const config = TAG_CHIP[tag];
                      return (
                        <Chip
                          key={tag}
                          size="small"
                          label={tag}
                          color={config.color}
                          variant={config.variant}
                          sx={{ fontSize: '0.6rem', height: 18, '& .MuiChip-label': { px: 0.75 } }}
                        />
                      );
                    })}
                    {items.length > 0 && (
                      <Chip
                        size="small"
                        label={`${stats.done}/${stats.total} 完了`}
                        color={stats.done === stats.total && stats.total > 0 ? 'success' : 'default'}
                        variant="outlined"
                      />
                    )}
                  </Box>
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
                          gap: 0.75,
                          py: 0.25,
                          px: 1,
                          borderRadius: 1,
                          bgcolor: status === 'done' ? 'action.hover' : 'transparent',
                          opacity: status === 'done' ? 0.7 : 1,
                          transition: motionTokens.transition.hoverAll,
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
                          sx={{ minWidth: 48 }}
                        />

                        {actionDefs.map((action) => (
                          <Button
                            key={action.id}
                            size="small"
                            variant={action.primary ? 'contained' : 'text'}
                            disabled={action.id !== 'handover-create' && status === 'done'}
                            onClick={() => onAction(action.id, key, item.userName)}
                            sx={{
                              textTransform: 'none',
                              fontSize: '0.7rem',
                              minWidth: 'auto',
                              minHeight: 32,
                              px: 0.5,
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
    </Box>
  );
}

// ─── Main Component ──────────────────────────────────────────

export const BriefingActionList: React.FC<BriefingActionListProps> = ({ alerts }) => {
  const { getState, setState, completionStats } = useAlertActionState();
  const ymd = toLocalDateISO();
  const navigate = useNavigate();
  const [snackbarMsg, setSnackbarMsg] = useState<string | null>(null);

  /** Briefing row action handler — 各ボタンに実際の動作を接続 */
  const handleAction = useCallback((actionId: string, alertKey: string, userName: string) => {
    if (actionId === 'handover-create') {
      // 既存の申し送りダイアログを開く
      window.dispatchEvent(new CustomEvent('handoff-open-quicknote-dialog'));
    } else if (actionId === 'contact-confirm') {
      // 欠席情報の登録: 出欠ページに遷移して欠席ダイアログを自動起動
      // alertKey = "absent:USER_CODE:YYYY-MM-DD"
      const userCode = alertKey.split(':')[1];
      navigate(`/daily/attendance?absence=${userCode}`);
    } else {
      // その他の確認系アクション: ステータス更新 + フィードバック
      setState(alertKey, 'done');
      const actionLabel = actionId === 'arrival-confirm' ? '到着確認'
        : actionId === 'departure-confirm' ? '退所確認'
        : actionId === 'transport-confirm' ? '送迎確認'
        : '確認';
      setSnackbarMsg(`✅ ${userName}：${actionLabel}済み`);
    }
  }, [setState, navigate]);

  // Split into today vs ongoing sections
  const { todayAlerts, ongoingAlerts } = useMemo(() => {
    const today: BriefingAlert[] = [];
    const ongoing: BriefingAlert[] = [];

    alerts.forEach((alert) => {
      if (alert.section === 'ongoing') {
        ongoing.push(alert);
      } else {
        // Default to 'today' for backward compatibility
        today.push(alert);
      }
    });

    return { todayAlerts: today, ongoingAlerts: ongoing };
  }, [alerts]);

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
    <>
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
            📋 対応が必要な申し送り
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

      <AccordionDetails data-testid="today-briefing-actions" sx={{ pt: 0, px: 2.5, pb: 2 }}>
        <Stack spacing={2.5}>
          {/* Section A: 今日の共有事項 */}
          <AlertSection
            title="今日の共有事項"
            emoji="📌"
            alerts={todayAlerts}
            getState={getState}
            onAction={handleAction}
            completionStats={completionStats}
            ymd={ymd}
          />

          {/* Divider between sections (only if both have content) */}
          {todayAlerts.length > 0 && ongoingAlerts.length > 0 && (
            <Box sx={{ borderTop: 1, borderColor: 'divider', my: 1 }} />
          )}

          {/* Section B: 最近の引き継ぎ要点 */}
          <AlertSection
            title="最近の引き継ぎ要点"
            emoji="🔄"
            alerts={ongoingAlerts}
            getState={getState}
            onAction={handleAction}
            completionStats={completionStats}
            ymd={ymd}
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
    <Snackbar
      open={snackbarMsg !== null}
      autoHideDuration={2000}
      onClose={() => setSnackbarMsg(null)}
      message={snackbarMsg}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    />
    </>
  );
};
