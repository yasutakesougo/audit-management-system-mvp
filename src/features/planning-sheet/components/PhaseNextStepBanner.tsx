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
  resolveNextStepBanner,
  type BannerContext,
  type BannerTone,
  type ResolveNextStepInput,
} from '@/domain/bridge/nextStepBanner';
import type { WorkflowPhase } from '@/domain/bridge/workflowPhase';
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

// ─── Component ────────────────────────────────────────────────

export const PhaseNextStepBanner: React.FC<PhaseNextStepBannerProps> = ({
  phase,
  context,
  userId,
  planningSheetId,
  hasMonitoringSignals,
  hasUnappliedReassessment,
  onNavigate,
}) => {
  const input: ResolveNextStepInput = {
    phase,
    context,
    userId,
    planningSheetId,
    hasMonitoringSignals,
    hasUnappliedReassessment,
  };

  const model = resolveNextStepBanner(input);

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
