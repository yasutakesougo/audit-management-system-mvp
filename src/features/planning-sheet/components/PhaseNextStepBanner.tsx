/**
 * PhaseNextStepBanner — 画面内「次のアクション」バナー
 *
 * 各タブ画面の上部に表示し、「今この画面を見ている人」に
 * 次にやるべきことを1つだけ提示する。
 *
 * ── ルール ──
 * 1. CTA は必ず1つだけ
 * 2. 説明は2行以内
 * 3. 主語は「次に何をするか」
 * 4. 不要なときは非表示
 *
 * ── 使い方 ──
 * ```tsx
 * <PhaseNextStepBanner
 *   phase="monitoring_overdue"
 *   context="overview"
 *   planningSheetId="ps-1"
 *   onNavigate={(href) => navigate(href)}
 * />
 * ```
 *
 * @see src/domain/bridge/nextStepBanner.ts
 */
import {
  getNextStepBanner,
  type BannerContext,
  type BannerTone,
  type NextStepAlertPriority,
  type ResolveNextStepInput,
  type WorkflowPhase,
} from '@/app/services/bridgeProxy';
import type { PdcaCycleState } from '@/domain/isp/types';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Alert, Box, Button, Typography } from '@mui/material';
import React from 'react';

// ─── Props ────────────────────────────────────────────────────

export interface PhaseNextStepBannerProps {
  /** 利用者の現在のワークフローフェーズ */
  phase: WorkflowPhase;
  /** 表示先の画面コンテキスト */
  context: BannerContext;
  /** 利用者ID */
  userId?: string;
  /** 計画シートID */
  planningSheetId?: string;
  /** モニタリングで重要シグナルが検出されたか */
  hasMonitoringSignals?: boolean;
  /** 再評価結果が未反映か */
  hasUnappliedReassessment?: boolean;
  /** 計画更新案が未反映か */
  hasPendingPlanUpdate?: boolean;
  /** 期限超過の計画更新案があるか */
  hasOverduePlanUpdate?: boolean;
  /** PDCA サイクル状態（optional） */
  pdcaCycleState?: PdcaCycleState | null;
  /** 遷移ハンドラ */
  onNavigate?: (href: string) => void;
}

// ─── Tone mapping ─────────────────────────────────────────────

const TONE_MAP: Record<BannerTone, {
  severity: 'info' | 'success' | 'warning' | 'error';
  icon: React.ReactElement;
}> = {
  info: { severity: 'info', icon: <InfoOutlinedIcon /> },
  success: { severity: 'success', icon: <CheckCircleOutlineIcon /> },
  warning: { severity: 'warning', icon: <WarningAmberIcon /> },
  danger: { severity: 'error', icon: <ErrorOutlineIcon /> },
};

const PRIORITY_LABELS: Record<NextStepAlertPriority, string> = {
  p0: '早急対応',
  p1: '注意',
  p2: '確認',
};

const PRIORITY_COLORS: Record<NextStepAlertPriority, string> = {
  p0: 'error.main',
  p1: 'warning.main',
  p2: 'text.secondary',
};

const P0_EMPHASIS_COLOR = 'error.dark';

// ─── Component ────────────────────────────────────────────────

export const PhaseNextStepBanner: React.FC<PhaseNextStepBannerProps> = ({
  phase,
  context,
  userId,
  planningSheetId,
  hasMonitoringSignals,
  hasUnappliedReassessment,
  hasPendingPlanUpdate,
  hasOverduePlanUpdate,
  pdcaCycleState,
  onNavigate,
}) => {
  const input: ResolveNextStepInput = {
    phase,
    context,
    userId,
    planningSheetId,
    hasMonitoringSignals,
    hasUnappliedReassessment,
    hasPendingPlanUpdate,
    hasOverduePlanUpdate,
    pdcaCycleState,
  };

  const model = getNextStepBanner(input);

  // hidden ならレンダリングしない
  if (model.hidden) return null;

  const toneConfig = TONE_MAP[model.tone];

  return (
    <Alert
      severity={toneConfig.severity}
      icon={toneConfig.icon}
      variant="outlined"
      data-testid={`next-step-banner-${context}`}
      sx={{
        mb: 2,
        '& .MuiAlert-message': { width: '100%' },
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight={700} sx={{ mb: 0.25 }}>
            {model.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {model.description}
          </Typography>
          {model.alerts.length > 0 && (
            <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2 }}>
              {model.alerts.map((alert, index) => (
                <Typography
                  key={`${alert.type}-${alert.message}-${index}`}
                  component="li"
                  variant="caption"
                  color={PRIORITY_COLORS[alert.priority]}
                  data-p0-emphasis={alert.priority === 'p0' ? 'true' : undefined}
                  sx={{
                    fontWeight: alert.priority === 'p0' ? 700 : 400,
                    ...(alert.priority === 'p0' ? { color: P0_EMPHASIS_COLOR } : {}),
                  }}
                >
                  [{PRIORITY_LABELS[alert.priority]}] {alert.message}（{alert.action}）
                </Typography>
              ))}
            </Box>
          )}
        </Box>

        {model.ctaLabel && model.href && (
          <Button
            size="small"
            variant="outlined"
            color={toneConfig.severity === 'error' ? 'error' : toneConfig.severity}
            endIcon={<ArrowForwardIcon sx={{ fontSize: '14px !important' }} />}
            onClick={() => onNavigate?.(model.href)}
            data-testid={`next-step-cta-${context}`}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              fontSize: '0.75rem',
              flexShrink: 0,
            }}
          >
            {model.ctaLabel}
          </Button>
        )}
      </Box>
    </Alert>
  );
};
