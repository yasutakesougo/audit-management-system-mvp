/**
 * UrgentHandoffHero — ZONE A: 最優先の未対応申し送り1件
 *
 * 責務:
 * - resolveNextHandoffAction の結果を大きく表示する
 * - CTA は「確認する」（Handoff は "読む情報" の比重が高いため）
 * - 全件対応済の場合は ✅ 空状態を表示
 *
 * 設計:
 * - props コールバックのみ呼ぶ（テレメトリは Step 3 で Page 層に接続）
 * - ドメインロジック呼び出しなし（親から結果を受け取る）
 * - MUI コンポーネントのみ使用
 */

import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutline as DoneIcon,
  OpenInNew as OpenIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { NextHandoffAction } from '../domain/resolveNextHandoffAction';
import { getSeverityColor } from '../handoffConstants';

// ─── Props ──────────────────────────────────────────────────

export type UrgentHandoffHeroProps = {
  /** resolveNextHandoffAction の結果（null = 全件対応済） */
  action: NextHandoffAction | null;
  /** 「確認する」ボタン押下 — ページ側で遷移 or 詳細表示 */
  onConfirm?: (recordId: number) => void;
  /** 「対応済にする」ボタン押下 — ステータス更新 */
  onMarkDone?: (recordId: number) => void;
};

// ─── 理由別スタイル ─────────────────────────────────────────

const REASON_STYLES = {
  critical: {
    borderColor: 'error.main',
    bgColor: 'error.50',
    iconColor: 'error.main',
    label: '🔴 重要 — 最優先で確認',
  },
  caution: {
    borderColor: 'warning.main',
    bgColor: 'warning.50',
    iconColor: 'warning.main',
    label: '🟡 要注意 — 確認推奨',
  },
  normal: {
    borderColor: 'grey.400',
    bgColor: 'grey.50',
    iconColor: 'text.secondary',
    label: '📝 通常 — 未対応あり',
  },
} as const;

// ─── Component ──────────────────────────────────────────────

export function UrgentHandoffHero({
  action,
  onConfirm,
  onMarkDone,
}: UrgentHandoffHeroProps) {
  // ── 全件対応済 ──
  if (!action) {
    return (
      <Card
        variant="outlined"
        sx={{
          mb: 2,
          borderColor: 'success.light',
          bgcolor: 'success.50',
        }}
        data-testid="handoff-hero-empty"
      >
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DoneIcon color="success" />
            <Typography variant="body1" fontWeight={600}>
              ✅ 未対応の申し送りはありません
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // ── 最優先1件 ──
  const { record, reason } = action;
  const style = REASON_STYLES[reason];

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        borderColor: style.borderColor,
        borderWidth: 2,
        bgcolor: style.bgColor,
      }}
      data-testid="handoff-hero"
    >
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        {/* ヘッダー: 優先度ラベル */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <WarningIcon sx={{ color: style.iconColor, fontSize: '1.2rem' }} />
          <Typography variant="subtitle2" sx={{ color: style.iconColor, fontWeight: 700 }}>
            {style.label}
          </Typography>
        </Stack>

        {/* メインコンテンツ: 利用者名 + メッセージ */}
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
          {record.userDisplayName}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            mb: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {record.message}
        </Typography>

        {/* メタ情報: カテゴリ / 重要度 / 時間帯 / 記録者 */}
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5, rowGap: 0.5 }}>
          <Chip
            size="small"
            label={record.category}
            variant="outlined"
          />
          <Chip
            size="small"
            label={record.severity}
            color={getSeverityColor(record.severity)}
          />
          <Chip
            size="small"
            label={record.timeBand}
            variant="outlined"
          />
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
            記録: {record.createdByName}
          </Typography>
        </Stack>

        {/* CTA ボタン */}
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            size="small"
            startIcon={<OpenIcon />}
            onClick={() => onConfirm?.(record.id)}
            data-testid="handoff-hero-confirm"
          >
            確認する
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DoneIcon />}
            onClick={() => onMarkDone?.(record.id)}
            data-testid="handoff-hero-done"
            color="success"
          >
            対応済にする
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
