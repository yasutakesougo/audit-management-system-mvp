/**
 * RegulatorySummaryBand — 制度適合 HUD 信号灯帯
 *
 * P2-B: 制度状態を信号灯（🟢 OK / 🟡 注意 / 🔴 未対応）で可視化し、
 * クリックで該当タブへ遷移できる。
 *
 * 判定ロジックは domain/regulatoryHud.ts の純関数に完全分離。
 * このコンポーネントは受け取った HudItem[] を表示するだけ。
 */
import React, { useMemo } from 'react';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import type { IspComplianceMetadata, SupportPlanBundle } from '@/domain/isp/schema';
import type { DeadlineInfo, SectionKey } from '../types';
import {
  buildRegulatoryHudItems,
  worstSignal,
  signalCounts,
  type RegulatoryHudInput,
  type RegulatoryHudItem,
  type RegulatorySignal,
} from '../domain/regulatoryHud';

// ────────────────────────────────────────────
// 信号灯の色マッピング
// ────────────────────────────────────────────

const SIGNAL_CHIP_COLOR: Record<RegulatorySignal, 'success' | 'warning' | 'error'> = {
  ok: 'success',
  warning: 'warning',
  danger: 'error',
};

const SIGNAL_ICON: Record<RegulatorySignal, React.ReactElement> = {
  ok: <CheckCircleRoundedIcon />,
  warning: <WarningAmberRoundedIcon />,
  danger: <ErrorRoundedIcon />,
};

const SIGNAL_EMOJI: Record<RegulatorySignal, string> = {
  ok: '🟢',
  warning: '🟡',
  danger: '🔴',
};

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────

type RegulatorySummaryBandProps = {
  bundle: SupportPlanBundle;
  /** 制度適合メタデータ（コンプライアンスタブの入力データ） */
  compliance?: IspComplianceMetadata | null;
  /** 期限情報 */
  deadlines?: {
    creation: DeadlineInfo;
    monitoring: DeadlineInfo;
  };
  /** Iceberg 分析件数の合計 */
  icebergTotal?: number;
  /** HUD チップクリック時に該当タブへ遷移するコールバック */
  onNavigateToTab?: (sub: SectionKey) => void;
};

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export const RegulatorySummaryBand: React.FC<RegulatorySummaryBandProps> = ({
  bundle,
  compliance = null,
  deadlines,
  icebergTotal: icebergTotalProp,
  onNavigateToTab,
}) => {
  // fallback: bundle から Iceberg 件数を算出
  const icebergTotal = useMemo(() => {
    if (icebergTotalProp != null) return icebergTotalProp;
    if (!bundle.icebergCountBySheet) return 0;
    return Object.values(bundle.icebergCountBySheet).reduce((a, b) => a + b, 0);
  }, [icebergTotalProp, bundle.icebergCountBySheet]);

  // fallback: deadlines がない場合はデフォルト
  const resolvedDeadlines = useMemo(
    () =>
      deadlines ?? {
        creation: { label: '作成期限', color: 'default' as const },
        monitoring: { label: 'モニタ期限', color: 'default' as const },
      },
    [deadlines],
  );

  // HUD 項目を生成
  const hudInput: RegulatoryHudInput = useMemo(
    () => ({
      ispStatus: bundle.isp.status,
      compliance,
      deadlines: resolvedDeadlines,
      latestMonitoring: bundle.latestMonitoring,
      icebergTotal,
    }),
    [bundle.isp.status, compliance, resolvedDeadlines, bundle.latestMonitoring, icebergTotal],
  );

  const hudItems = useMemo(() => buildRegulatoryHudItems(hudInput), [hudInput]);
  const worst = useMemo(() => worstSignal(hudItems), [hudItems]);
  const counts = useMemo(() => signalCounts(hudItems), [hudItems]);

  // ── バンドのボーダー色 ──
  const borderColorMap: Record<RegulatorySignal, string> = {
    ok: 'success.main',
    warning: 'warning.main',
    danger: 'error.main',
  };

  return (
    <Paper
      variant="outlined"
      data-testid="regulatory-summary-band"
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1, md: 1.25 },
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(30,60,90,0.5) 0%, rgba(20,40,60,0.5) 100%)'
            : 'linear-gradient(135deg, rgba(232,245,255,0.8) 0%, rgba(240,248,255,0.9) 100%)',
        borderColor: borderColorMap[worst],
        borderWidth: worst === 'ok' ? 1 : 2,
        transition: 'border-color 0.3s ease',
      }}
    >
      <Stack spacing={0.75}>
        {/* ── ヘッダー行 ── */}
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          alignItems="center"
        >
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mr: 0.5 }}>
            <AssessmentRoundedIcon sx={{ fontSize: 16 }} color="primary" />
            <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
              制度サマリー
            </Typography>
          </Stack>

          {/* サマリーバッジ */}
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: `${borderColorMap[worst]}`,
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 700,
              lineHeight: 1.4,
              minWidth: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            {counts.danger > 0 && `${SIGNAL_EMOJI.danger} ${counts.danger}`}
            {counts.warning > 0 && ` ${SIGNAL_EMOJI.warning} ${counts.warning}`}
            {counts.danger === 0 && counts.warning === 0 && `${SIGNAL_EMOJI.ok} すべて完了`}
          </Box>
        </Stack>

        {/* ── 信号灯チップ一覧 ── */}
        <Stack
          direction="row"
          spacing={0.75}
          flexWrap="wrap"
          useFlexGap
          alignItems="center"
        >
          {hudItems.map((item) => (
            <HudChip key={item.key} item={item} onNavigateToTab={onNavigateToTab} />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
};

// ────────────────────────────────────────────
// 個別チップ
// ────────────────────────────────────────────

const HudChip: React.FC<{
  item: RegulatoryHudItem;
  onNavigateToTab?: (sub: SectionKey) => void;
}> = ({ item, onNavigateToTab }) => {
  const chipColor = SIGNAL_CHIP_COLOR[item.signal];
  const chipIcon = SIGNAL_ICON[item.signal];
  const isClickable = !!item.navigateTo && !!onNavigateToTab;

  const chip = (
    <Chip
      size="small"
      variant={item.signal === 'ok' ? 'outlined' : 'filled'}
      color={chipColor}
      icon={chipIcon}
      label={item.label}
      data-testid={`hud-chip-${item.key}`}
      onClick={isClickable ? () => onNavigateToTab!(item.navigateTo!) : undefined}
      sx={{
        cursor: isClickable ? 'pointer' : 'default',
        fontWeight: item.signal === 'danger' ? 700 : 500,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': isClickable
          ? {
              transform: 'translateY(-1px)',
              boxShadow: 1,
            }
          : undefined,
      }}
    />
  );

  if (item.detail) {
    return (
      <Tooltip title={item.detail} arrow placement="bottom">
        {chip}
      </Tooltip>
    );
  }

  return chip;
};

/** テスト用 export */
export { buildRegulatoryHudItems, worstSignal };
