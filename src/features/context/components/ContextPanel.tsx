/**
 * ContextPanel — 利用者コンテキスト参照パネル
 *
 * MVP-005: DailyRecord 入力時に「参照しながら入力」を実現する。
 *
 * ## 構成
 * - 支援計画サマリー: ISP目標の読み取り表示
 * - 最新申し送り: 直近の引き継ぎ事項
 * - 最近の記録: 過去数日の記録状況
 * - 注意事項: アラート一覧
 *
 * ## 設計方針
 * - Drawer (右スライド) で表示。呼び出し元の画面を遮らない
 * - 読み取り専用: 入力は行わない
 * - セクションは折りたたみ可能 (Accordion)
 */
import React from 'react';

// ── MUI ──
import AssignmentIcon from '@mui/icons-material/Assignment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HistoryIcon from '@mui/icons-material/History';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import SendIcon from '@mui/icons-material/Send';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ── Domain ──
import type {
  ContextAlert,
  ContextHandoff,
  ContextPanelData,
  ContextRecentRecord,
  ContextSupportPlan,
} from '../domain/contextPanelLogic';

// ─── Props ──────────────────────────────────────────────────

export type ContextPanelProps = {
  open: boolean;
  onClose: () => void;
  userName: string;
  data: ContextPanelData;
};

// ─── Constants ──────────────────────────────────────────────

const DRAWER_WIDTH = 380;

const GOAL_TYPE_COLORS: Record<string, string> = {
  long: '#1e88e5',
  short: '#43a047',
  support: '#f4511e',
};

const GOAL_TYPE_LABELS: Record<string, string> = {
  long: '長期',
  short: '短期',
  support: '支援',
};

// ─── Main Component ──────────────────────────────────────────

export const ContextPanel: React.FC<ContextPanelProps> = ({
  open,
  onClose,
  userName,
  data,
}) => {
  const alertCount = data.alerts.filter((a) => a.level !== 'info').length;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      sx={{
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderLeft: '1px solid',
          borderColor: 'divider',
        },
      }}
      data-testid="context-panel"
    >
      {/* ── Header ── */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              📖 コンテキスト
            </Typography>
            {alertCount > 0 && (
              <Badge badgeContent={alertCount} color="warning" />
            )}
          </Stack>
          <IconButton onClick={onClose} size="small" data-testid="context-panel-close">
            <ChevronRightIcon />
          </IconButton>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {userName}さんの支援コンテキスト
        </Typography>
      </Box>

      {/* ── Content ── */}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        {/* Section 1: Alerts */}
        {data.alerts.length > 0 && (
          <Box sx={{ p: 1.5 }} data-testid="context-alerts">
            <Stack spacing={1}>
              {data.alerts.map((alert) => (
                <AlertItem key={alert.key} alert={alert} />
              ))}
            </Stack>
          </Box>
        )}

        {/* Section: Summary & Prompts */}
        <Box sx={{ p: 2, bgcolor: 'primary.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={0.5} sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AutoAwesomeIcon fontSize="small" sx={{ fontSize: 16 }} /> コンテキスト要約
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.6, fontSize: '0.85rem' }}>
              {data.summary}
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <LightbulbOutlinedIcon fontSize="small" sx={{ fontSize: 16 }} /> 今回の入力で確認したいこと
            </Typography>
            <Stack spacing={0.5}>
              {data.prompts.map((prompt, i) => (
                <Typography key={i} variant="body2" sx={{ fontSize: '0.8rem', bgcolor: 'background.paper', p: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  {prompt}
                </Typography>
              ))}
            </Stack>
          </Stack>
        </Box>

        {/* Section 2: Support Plan */}
        <ContextAccordion
          icon={<AssignmentIcon fontSize="small" />}
          title="支援計画"
          defaultExpanded
          testId="context-support-plan"
        >
          <SupportPlanSection plan={data.supportPlan} />
        </ContextAccordion>

        {/* Section 3: Handoff */}
        <ContextAccordion
          icon={<SendIcon fontSize="small" />}
          title="申し送り"
          badge={data.handoffs.length}
          defaultExpanded={data.handoffs.length > 0}
          testId="context-handoffs"
        >
          <HandoffSection handoffs={data.handoffs} />
        </ContextAccordion>

        {/* Section 4: Recent Records */}
        <ContextAccordion
          icon={<HistoryIcon fontSize="small" />}
          title="最近の記録"
          badge={data.recentRecords.length}
          defaultExpanded={false}
          testId="context-recent-records"
        >
          <RecentRecordsSection records={data.recentRecords} />
        </ContextAccordion>
      </Box>
    </Drawer>
  );
};

// ─── Sub Components ──────────────────────────────────────────

type ContextAccordionProps = {
  icon: React.ReactNode;
  title: string;
  badge?: number;
  defaultExpanded?: boolean;
  testId: string;
  children: React.ReactNode;
};

const ContextAccordion: React.FC<ContextAccordionProps> = ({
  icon,
  title,
  badge,
  defaultExpanded = false,
  testId,
  children,
}) => (
  <Accordion
    defaultExpanded={defaultExpanded}
    disableGutters
    elevation={0}
    sx={{ '&:before': { display: 'none' }, borderBottom: '1px solid', borderColor: 'divider' }}
    data-testid={testId}
  >
    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        {icon}
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {badge != null && badge > 0 && (
          <Chip label={badge} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
        )}
      </Stack>
    </AccordionSummary>
    <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
      {children}
    </AccordionDetails>
  </Accordion>
);

// ── Alert Item ──

const AlertItem: React.FC<{ alert: ContextAlert }> = ({ alert }) => {
  const severityMap = {
    error: 'error' as const,
    warning: 'warning' as const,
    info: 'info' as const,
  };
  const iconMap = {
    error: <ErrorOutlineIcon fontSize="small" />,
    warning: <WarningAmberIcon fontSize="small" />,
    info: <InfoOutlinedIcon fontSize="small" />,
  };
  return (
    <Alert
      severity={severityMap[alert.level]}
      icon={iconMap[alert.level]}
      sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: '0.8rem' } }}
    >
      {alert.message}
    </Alert>
  );
};

// ── Support Plan Section ──

const SupportPlanSection: React.FC<{ plan: ContextSupportPlan }> = ({ plan }) => {
  if (plan.status === 'none') {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        個別支援計画書は未作成です
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Chip
          label={plan.status === 'confirmed' ? '確定' : 'ドラフト'}
          size="small"
          color={plan.status === 'confirmed' ? 'success' : 'default'}
        />
        {plan.planPeriod && (
          <Typography variant="caption" color="text.secondary">
            {plan.planPeriod}
          </Typography>
        )}
      </Stack>
      {plan.goals.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          目標が未設定です
        </Typography>
      ) : (
        plan.goals.map((goal, i) => (
          <Box key={i} sx={{ borderLeft: 3, borderColor: GOAL_TYPE_COLORS[goal.type] ?? '#757575', pl: 1.5 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                label={GOAL_TYPE_LABELS[goal.type] ?? goal.type}
                size="small"
                sx={{ bgcolor: GOAL_TYPE_COLORS[goal.type] ?? '#757575', color: '#fff', height: 20, fontSize: '0.65rem' }}
              />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {goal.label}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
              {goal.text || '未入力'}
            </Typography>
          </Box>
        ))
      )}
    </Stack>
  );
};

// ── Handoff Section ──

const HandoffSection: React.FC<{ handoffs: ContextHandoff[] }> = ({ handoffs }) => {
  if (handoffs.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        直近の申し送りはありません
      </Typography>
    );
  }

  return (
    <Stack spacing={1} divider={<Divider />}>
      {handoffs.slice(0, 5).map((h) => (
        <Box key={h.id}>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
            <Chip
              label={h.category}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
            {h.severity === '重要' && (
              <Chip label="重要" size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />
            )}
            <Typography variant="caption" color="text.secondary">
              {h.status}
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
            {h.message.length > 80 ? `${h.message.slice(0, 80)}…` : h.message}
          </Typography>
        </Box>
      ))}
      {handoffs.length > 5 && (
        <Typography variant="caption" color="text.secondary" textAlign="center">
          他 {handoffs.length - 5}件
        </Typography>
      )}
    </Stack>
  );
};

// ── Recent Records Section ──

const RecentRecordsSection: React.FC<{ records: ContextRecentRecord[] }> = ({ records }) => {
  if (records.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        直近の記録はありません
      </Typography>
    );
  }

  return (
    <Stack spacing={1} divider={<Divider />}>
      {records.slice(0, 5).map((r, i) => (
        <Box key={i}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 80 }}>
              {r.date}
            </Typography>
            <Chip
              label={r.status}
              size="small"
              color={r.status === '完了' ? 'success' : 'default'}
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          </Stack>
          {r.specialNotes && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
              📝 {r.specialNotes.length > 60 ? `${r.specialNotes.slice(0, 60)}…` : r.specialNotes}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
};
