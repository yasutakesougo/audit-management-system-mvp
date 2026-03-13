/**
 * TodayPhaseIndicator — /today で OperationalPhase を表示するコンパクトバナー
 *
 * 目的:
 *   - 現在の業務フェーズを可視化し、スタッフに「今は何の時間か」を即伝える
 *   - /today が主役でないフェーズでは、主役画面への誘導サジェストを出す
 *   - dismiss 可能（慣れた職員の邪魔をしない）
 *
 * Phase 3 (設定値ベース判定):
 *   - resolvePhaseFromConfig() で設定配列から判定
 *   - config 未指定時は DEFAULT_PHASE_CONFIG にフォールバック
 *
 * @see features/operationFlow/domain/phaseConfigBridge.ts
 */
import { DEFAULT_PHASE_CONFIG } from '@/features/operationFlow/domain/defaultPhaseConfig';
import { resolvePhaseFromConfig } from '@/features/operationFlow/domain/phaseConfigBridge';
import type { OperationFlowPhaseConfig } from '@/features/operationFlow/domain/operationFlowTypes';
import { useOperationFlowConfig } from '@/features/operationFlow/hooks/useOperationFlowConfig';
import { PHASE_EVENTS, recordPhaseEvent } from '@/features/operationFlow/telemetry/recordPhaseEvent';
import type { OperationalPhase, PrimaryScreen } from '@/shared/domain/operationalPhase';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, Chip, IconButton, Stack, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';

// ────────────────────────────────────────
// Pure Logic
// ────────────────────────────────────────

/** /today に対するフェーズヒント情報 */
export type TodayPhaseHint = {
  phase: OperationalPhase;
  label: string;
  /** 今の /today が主役かどうか */
  isTodayPrimary: boolean;
  /** 主役画面パス */
  primaryScreen: PrimaryScreen;
  /** 主役画面の表示名 */
  primaryScreenLabel: string;
  /** フェーズに応じた一言メッセージ */
  message: string;
};

/** 画面パスの表示名 */
const SCREEN_LABELS: Record<PrimaryScreen, string> = {
  '/today': '今日の業務',
  '/daily': '日々の記録',
  '/handoff-timeline': '申し送り',
  '/dashboard': '運営状況',
};

/** フェーズごとの /today 向けメッセージ */
const PHASE_MESSAGES: Record<OperationalPhase, string> = {
  'preparation':     '今日の予定と出欠を確認しましょう',
  'morning-meeting': '朝会中です。申し送りの確認がメインです',
  'am-operation':    '午前活動中。未記録があれば進めましょう',
  'pm-operation':    '午後活動中。午前分の記録を先に確認しましょう',
  'evening-closing': '帰り支度の時間です。残りの記録を仕上げましょう',
  'record-review':   '今日の記録を振り返り、仕上げの時間です',
};

/**
 * 現在のフェーズから /today 向けのヒント情報を返す（純粋関数）
 *
 * @param now    - 判定対象の日時（デフォルト: 現在時刻）
 * @param config - フェーズ設定配列（省略時は DEFAULT_PHASE_CONFIG）
 */
export function getTodayPhaseHint(
  now: Date = new Date(),
  config: readonly OperationFlowPhaseConfig[] = DEFAULT_PHASE_CONFIG,
): TodayPhaseHint {
  const resolved = resolvePhaseFromConfig(now, config);
  const primaryScreenLabel = SCREEN_LABELS[resolved.legacyPrimaryScreen];
  const message = PHASE_MESSAGES[resolved.operationalPhase];

  return {
    phase: resolved.operationalPhase,
    label: resolved.phaseLabel,
    isTodayPrimary: resolved.isTodayPrimary,
    primaryScreen: resolved.legacyPrimaryScreen,
    primaryScreenLabel,
    message,
  };
}

// ────────────────────────────────────────
// Component
// ────────────────────────────────────────

export type TodayPhaseIndicatorProps = {
  /** テスト用: 現在時刻を注入 */
  now?: Date;
  /** 別画面への遷移ハンドラ */
  onNavigate?: (path: string) => void;
};

export const TodayPhaseIndicator: React.FC<TodayPhaseIndicatorProps> = ({
  now,
  onNavigate,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const { config } = useOperationFlowConfig();
  const hint = getTodayPhaseHint(now, config);

  // ── 観測: 表示イベント (dedupe で重複防止) ──
  useEffect(() => {
    if (!dismissed) {
      recordPhaseEvent(
        { event: PHASE_EVENTS.SUGGEST_SHOWN, phase: hint.phase, screen: '/today' },
        { dedupe: true },
      );
    }
  }, [dismissed, hint.phase]);

  if (dismissed) return null;

  // フェーズごとの色テーマ
  const colorMap: Record<OperationalPhase, 'info' | 'warning' | 'success'> = {
    'preparation':     'info',
    'morning-meeting': 'warning',
    'am-operation':    'info',
    'pm-operation':    'info',
    'evening-closing': 'warning',
    'record-review':   'success',
  };
  const color = colorMap[hint.phase];

  const colorValue =
    color === 'info' ? '#2196f3' :
    color === 'warning' ? '#ff9800' :
    '#4caf50';

  return (
    <Box
      data-testid="today-phase-indicator"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        borderRadius: 2,
        bgcolor: `${colorValue}14`,
        border: `1px solid ${colorValue}30`,
        mb: 1.5,
      }}
    >
      <AccessTimeIcon sx={{ color: colorValue, fontSize: 18 }} />

      <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.25}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip
            label={hint.label}
            size="small"
            sx={{
              bgcolor: `${colorValue}20`,
              color: colorValue,
              fontWeight: 700,
              fontSize: '0.7rem',
              height: 22,
            }}
          />
          <Typography
            variant="body2"
            sx={{ color: 'text.primary', fontSize: '0.8rem' }}
          >
            {hint.message}
          </Typography>
        </Stack>

        {/* 主役画面が /today 以外なら誘導 */}
        {!hint.isTodayPrimary && onNavigate && (
          <Box sx={{ mt: 0.5 }}>
            <Button
              size="small"
              variant="text"
              startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              onClick={() => {
                recordPhaseEvent({
                  event: PHASE_EVENTS.SUGGEST_ACCEPTED,
                  phase: hint.phase,
                  screen: '/today',
                });
                onNavigate(hint.primaryScreen);
              }}
              sx={{
                color: colorValue,
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'none',
                p: 0,
                minHeight: 0,
                '&:hover': { bgcolor: `${colorValue}10` },
              }}
            >
              今は「{hint.primaryScreenLabel}」がメインの時間帯です
            </Button>
          </Box>
        )}
      </Stack>

      <IconButton
        size="small"
        onClick={() => {
          recordPhaseEvent({
            event: PHASE_EVENTS.SUGGEST_DISMISSED,
            phase: hint.phase,
            screen: '/today',
          });
          setDismissed(true);
        }}
        aria-label="フェーズ表示を閉じる"
        sx={{ color: 'text.secondary', p: 0.5 }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
};
