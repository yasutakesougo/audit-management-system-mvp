/**
 * ProgressRings — 4指標のコンパクト進捗表示
 *
 * Step 3: ZONE B を「4つの小さな証拠」に圧縮する。
 *
 * 表示する指標:
 * 1. 支援手順   → 完了率リング (completed / total)
 * 2. ケース記録 → 完了率リング (completed / total)
 * 3. 出欠       → 完了率リング (attended / scheduled)
 * 4. 連絡       → 件数モード可 (count only, no percentage)
 *
 * ⚠️ データ取得や計算ロジックは追加しない。
 *    Props で受け取った値をそのまま表示する。
 *
 * ⚠️ useTodaySummary / useTodayLayoutProps は変更しない。
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import { motionTokens } from '@/app/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

// ─── Types ───────────────────────────────────────────────────

export type ProgressRingItem = {
  key: 'records' | 'caseRecords' | 'attendance' | 'contacts' | 'recordsUser';
  label: string;
  /** 表示テキスト: "5 / 12" や "2件" */
  valueText: string;
  /** 0-100。件数モードなら undefined 可 */
  progress?: number;
  status: 'complete' | 'in_progress' | 'attention';
  onClick?: () => void;
};

export type ProgressRingsProps = {
  items: ProgressRingItem[];
};

// ─── Status → Color ──────────────────────────────────────────

const STATUS_COLOR_MAP: Record<ProgressRingItem['status'], string> = {
  complete: 'success',
  in_progress: 'primary',
  attention: 'warning',
};

const STATUS_LABEL_MAP: Record<ProgressRingItem['status'], string> = {
  complete: '完了',
  in_progress: '未完了',
  attention: '要対応',
};

// ─── SVG Ring ────────────────────────────────────────────────

const RING_SIZE = 72;
const STROKE_WIDTH = 5;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type RingProps = {
  progress: number; // 0-100
  colorKey: string; // 'success' | 'primary' | 'warning'
};

const SvgRing: React.FC<RingProps> = ({ progress, colorKey }) => {
  const theme = useTheme();
  const paletteColor = (() => {
    if (colorKey === 'success') return theme.palette.success.main;
    if (colorKey === 'primary') return theme.palette.primary.main;
    if (colorKey === 'warning') return theme.palette.warning.main;
    return theme.palette.grey[400];
  })();

  const offset = CIRCUMFERENCE - (Math.min(100, Math.max(0, progress)) / 100) * CIRCUMFERENCE;

  return (
    <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
      {/* Track */}
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={alpha(paletteColor, 0.15)}
        strokeWidth={STROKE_WIDTH}
      />
      {/* Progress arc */}
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={paletteColor}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: '50% 50%',
          transition: `stroke-dashoffset ${motionTokens.duration.moderate} ${motionTokens.easing.standard}`,
        }}
      />
    </svg>
  );
};

// ─── Count-Mode Indicator (no ring, display count badge) ─────

type CountBadgeProps = {
  valueText: string;
  colorKey: string;
};

const CountBadge: React.FC<CountBadgeProps> = ({ valueText, colorKey }) => {
  const theme = useTheme();
  const paletteColor = (() => {
    if (colorKey === 'success') return theme.palette.success.main;
    if (colorKey === 'primary') return theme.palette.primary.main;
    if (colorKey === 'warning') return theme.palette.warning.main;
    return theme.palette.grey[400];
  })();
  const countTextColor = theme.palette.mode === 'dark' ? theme.palette.grey[800] : paletteColor;

  return (
    <Box
      sx={{
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: '50%',
        border: `${STROKE_WIDTH}px solid`,
        borderColor: alpha(paletteColor, 0.25),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography
        variant="body1"
        sx={{ fontWeight: 700, color: countTextColor, lineHeight: 1 }}
      >
        {valueText}
      </Typography>
    </Box>
  );
};

// ─── Single Ring Item ────────────────────────────────────────

const RingItemView: React.FC<{ item: ProgressRingItem }> = ({ item }) => {
  const theme = useTheme();
  const colorKey = STATUS_COLOR_MAP[item.status];
  const statusLabel = STATUS_LABEL_MAP[item.status];
  const hasRing = item.progress != null;
  const ringLabelColor = theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.text.secondary;
  const statusTextColor = theme.palette.mode === 'dark' ? theme.palette.grey[800] : `${colorKey}.main`;

  const content = (
    <Box
      data-testid={`progress-ring-${item.key}`}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        py: 1,
        px: 1.5,
        position: 'relative',
      }}
    >
      {/* Label */}
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          fontSize: '0.7rem',
          color: ringLabelColor,
          letterSpacing: '0.04em',
        }}
      >
        {item.label}
      </Typography>

      {/* Ring or Count Badge */}
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        {hasRing ? (
          <>
            <SvgRing progress={item.progress!} colorKey={colorKey} />
            {/* Center value overlay */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, fontSize: '0.8rem', lineHeight: 1 }}
              >
                {item.valueText}
              </Typography>
            </Box>
          </>
        ) : (
          <CountBadge valueText={item.valueText} colorKey={colorKey} />
        )}
      </Box>

      {/* Status short text */}
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          fontSize: '0.65rem',
          color: statusTextColor,
        }}
      >
        {statusLabel}
      </Typography>
    </Box>
  );

  if (item.onClick) {
    return (
      <ButtonBase
        onClick={item.onClick}
        sx={{ borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}
        aria-label={`${item.label}の詳細を見る`}
      >
        {content}
      </ButtonBase>
    );
  }

  return content;
};

// ─── Component ───────────────────────────────────────────────

export const ProgressRings: React.FC<ProgressRingsProps> = ({ items }) => {
  return (
    <Box
      data-testid="progress-rings"
      sx={{
        display: 'flex',
        justifyContent: 'center',
        gap: { xs: 1, sm: 2 },
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        py: 1,
      }}
    >
      {items.map((item) => (
        <RingItemView key={item.key} item={item} />
      ))}
    </Box>
  );
};
